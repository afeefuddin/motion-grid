import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultCacheDirectory,
  GeneratedWorldRequestSchema,
  generatedCacheKey,
} from "../src/adapters/generated/store";
import { SimWorldSchema } from "../src/sim/schema";
import { simWorld } from "../src/sim/world";

const requests = [
  GeneratedWorldRequestSchema.parse({
    geography: "Pune",
    category: "dental clinics",
    limit: 20,
    seed: 20260808,
    latitude: 18.5204,
    longitude: 73.8567,
  }),
  GeneratedWorldRequestSchema.parse({
    geography: "Chennai",
    category: "cloud kitchens",
    limit: 20,
    seed: 20260808,
    latitude: 13.0827,
    longitude: 80.2707,
  }),
];

function slug(value: string): string {
  return value
    .toLocaleLowerCase("en-IN")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function warmedWorld(request: (typeof requests)[number]) {
  const world = structuredClone(simWorld);
  const prefix = generatedCacheKey(request).slice(0, 10);
  world.seed = request.seed;
  world.businesses.forEach((business, index) => {
    const oldName = business.name;
    const number = String(index + 1).padStart(2, "0");
    business.id = `generated-${prefix}-business-${number}`;
    business.name = `${request.geography} ${request.category} ${number}`;
    business.category = request.category;
    business.locality = `${request.geography} Locality ${1 + (index % 6)}`;
    business.address = `${11 + index}, Market Road, ${business.locality}, ${request.geography}`;
    business.geo.latitude = request.latitude + ((index % 10) - 5) * 0.002;
    business.geo.longitude =
      request.longitude + (Math.floor(index / 10) - 3) * 0.002;
    business.website.url = `https://${slug(business.name)}.example/`;
    business.website.html = business.website.html
      .replaceAll(oldName, business.name)
      .replaceAll("Bengaluru", request.geography);
    business.contacts.forEach((contact, contactIndex) => {
      contact.email = `owner${number}${contactIndex + 1}@${slug(business.name)}.example`;
    });
  });
  world.creators.forEach((creator, index) => {
    const number = String(index + 1).padStart(2, "0");
    creator.id = `generated-${prefix}-creator-${number}`;
    creator.bio = creator.bio.replaceAll("Bengaluru", request.geography);
    creator.audience.geography = { [request.geography]: 0.72, Other: 0.28 };
    creator.posts = [];
  });
  return SimWorldSchema.parse(world);
}

async function main(): Promise<void> {
  await mkdir(defaultCacheDirectory, { recursive: true });
  for (const request of requests) {
    const cachePath = path.join(
      defaultCacheDirectory,
      `${generatedCacheKey(request)}.json`,
    );
    await writeFile(
      cachePath,
      `${JSON.stringify({ request, world: warmedWorld(request) }, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(
      `Pre-warmed ${request.category} in ${request.geography}\n`,
    );
  }
}

void main();
