import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { type Business, type SimWorld, SimWorldSchema } from "../../sim/schema";

export const GeneratedWorldRequestSchema = z.object({
  geography: z.string().min(1),
  category: z.string().min(1),
  limit: z.int().positive().max(100),
  seed: z.int(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type GeneratedWorldRequest = z.infer<typeof GeneratedWorldRequestSchema>;

const CachedWorldSchema = z.object({
  request: GeneratedWorldRequestSchema,
  world: SimWorldSchema,
});

function assertArtifactKeys(value: z.infer<ReturnType<typeof z.json>>): void {
  if (Array.isArray(value)) {
    value.forEach(assertArtifactKeys);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/signal|finding|qualification|score/i.test(key)) {
        throw new Error(`Generated worlds cannot contain the key "${key}".`);
      }
      assertArtifactKeys(child);
    }
  }
}

function parseArtifactWorld(value: unknown): SimWorld {
  const json = z.json().parse(value);
  assertArtifactKeys(json);
  return SimWorldSchema.parse(json);
}

export type GenerateWorld = (
  request: GeneratedWorldRequest,
) => Promise<unknown>;

export const defaultCacheDirectory = path.join(
  process.cwd(),
  "src/adapters/generated/cache",
);

function requestIdentity(request: GeneratedWorldRequest): string {
  return JSON.stringify([
    request.geography.toLocaleLowerCase("en-IN"),
    request.category.toLocaleLowerCase("en-IN"),
    request.limit,
    request.seed,
  ]);
}

export function generatedCacheKey(request: GeneratedWorldRequest): string {
  return createHash("sha256").update(requestIdentity(request)).digest("hex");
}

/** Disk-backed generated-world store with validation on every external boundary. */
export class GeneratedMarketStore {
  readonly #cacheDirectory: string;
  readonly #generateWorld: GenerateWorld;
  readonly #worlds = new Map<string, SimWorld>();

  constructor(options: {
    readonly generateWorld: GenerateWorld;
    readonly cacheDirectory?: string;
  }) {
    this.#generateWorld = options.generateWorld;
    this.#cacheDirectory = options.cacheDirectory ?? defaultCacheDirectory;
  }

  async worldFor(input: GeneratedWorldRequest): Promise<SimWorld> {
    const request = GeneratedWorldRequestSchema.parse(input);
    const key = generatedCacheKey(request);
    const loaded = this.#worlds.get(key);
    if (loaded !== undefined) {
      return loaded;
    }

    await mkdir(this.#cacheDirectory, { recursive: true });
    const cachePath = path.join(this.#cacheDirectory, `${key}.json`);
    const files = await readdir(this.#cacheDirectory);
    if (files.includes(`${key}.json`)) {
      const cached = await readFile(cachePath, "utf8");
      const rawCache = z.json().parse(JSON.parse(cached));
      assertArtifactKeys(rawCache);
      const parsed = CachedWorldSchema.parse(rawCache);
      if (requestIdentity(parsed.request) !== requestIdentity(request)) {
        throw new Error(`Generated-market cache key mismatch at ${cachePath}.`);
      }
      this.#worlds.set(key, parsed.world);
      return parsed.world;
    }

    // Model output is validated before bytes can enter the committed cache.
    const world = parseArtifactWorld(await this.#generateWorld(request));
    const serialized = `${JSON.stringify({ request, world }, null, 2)}\n`;
    const temporaryPath = `${cachePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, serialized, "utf8");
    await rename(temporaryPath, cachePath);
    this.#worlds.set(key, world);
    return world;
  }

  async findBusiness(externalRef: string): Promise<Business | null> {
    for (const world of this.#worlds.values()) {
      const business = world.businesses.find(
        (candidate) => candidate.id === externalRef,
      );
      if (business !== undefined) {
        return business;
      }
    }

    await mkdir(this.#cacheDirectory, { recursive: true });
    const files = (await readdir(this.#cacheDirectory))
      .filter((file) => file.endsWith(".json"))
      .sort();
    for (const file of files) {
      const cachePath = path.join(this.#cacheDirectory, file);
      const rawCache = z
        .json()
        .parse(JSON.parse(await readFile(cachePath, "utf8")));
      assertArtifactKeys(rawCache);
      const cached = CachedWorldSchema.parse(rawCache);
      this.#worlds.set(generatedCacheKey(cached.request), cached.world);
      const business = cached.world.businesses.find(
        (candidate) => candidate.id === externalRef,
      );
      if (business !== undefined) {
        return business;
      }
    }
    return null;
  }
}
