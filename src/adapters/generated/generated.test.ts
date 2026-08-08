import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
  DbQueryOutputSchema,
  GeoQueryOutputSchema,
  PeopleFindOutputSchema,
  ReviewsFetchOutputSchema,
  WebFetchOutputSchema,
} from "../../contracts/capabilities";
import { simWorld } from "../../sim/world";
import { createGeneratedMarketAdapters } from "./adapters";
import { defaultCacheDirectory, GeneratedMarketStore } from "./store";

const temporaryDirectories: string[] = [];

after(async () => {
  for (const directory of temporaryDirectories) {
    await rm(directory, { recursive: true });
  }
});

test("cache hits make no model call and all generated capabilities parse", async () => {
  const cacheDirectory = await mkdtemp(
    path.join(os.tmpdir(), "motion-grid-generated-"),
  );
  temporaryDirectories.push(cacheDirectory);
  let modelCalls = 0;
  const firstStore = new GeneratedMarketStore({
    cacheDirectory,
    generateWorld: async () => {
      modelCalls += 1;
      return simWorld;
    },
  });
  const first = createGeneratedMarketAdapters(firstStore);
  const input = {
    query: "dental clinics in Pune",
    latitude: 18.5204,
    longitude: 73.8567,
    radiusKm: 15,
    limit: 20,
  };
  const firstOutput = GeoQueryOutputSchema.parse(
    await first.geo.execute("geo.query", input),
  );
  assert.equal(modelCalls, 1);

  const secondStore = new GeneratedMarketStore({
    cacheDirectory,
    generateWorld: async () => {
      modelCalls += 1;
      return simWorld;
    },
  });
  const second = createGeneratedMarketAdapters(secondStore);
  const secondOutput = GeoQueryOutputSchema.parse(
    await second.geo.execute("geo.query", input),
  );
  assert.equal(modelCalls, 1);
  assert.deepEqual(secondOutput, firstOutput);
  DbQueryOutputSchema.parse(
    await second.db.execute("db.query", {
      entityKind: "company",
      filters: { category: "dental clinics", locality: "Pune" },
      limit: 20,
    }),
  );

  const target = firstOutput.targets.find(() => true);
  if (target === undefined || target.kind !== "organization") {
    throw new Error("Generated geo adapter returned no organization.");
  }
  WebFetchOutputSchema.parse(
    await second.web.execute("web.fetch", {
      externalRef: target.externalRef,
      url: target.payload.websiteUrl ?? "https://missing.example/",
    }),
  );
  ReviewsFetchOutputSchema.parse(
    await second.reviews.execute("reviews.fetch", {
      externalRef: target.externalRef,
      limit: 6,
    }),
  );
  PeopleFindOutputSchema.parse(
    await second.people.execute("people.find", {
      externalRef: target.externalRef,
      channels: ["email", "whatsapp"],
    }),
  );
});

test("committed warm cache avoids the model", async () => {
  let modelCalls = 0;
  const store = new GeneratedMarketStore({
    cacheDirectory: defaultCacheDirectory,
    generateWorld: async () => {
      modelCalls += 1;
      return simWorld;
    },
  });
  const world = await store.worldFor({
    geography: "Pune",
    category: "dental clinics",
    limit: 20,
    seed: 20260808,
    latitude: 18.5204,
    longitude: 73.8567,
  });
  assert.equal(world.businesses.length, 60);
  assert.equal(modelCalls, 0);
});

test("locality selects a distinct generated world", async () => {
  const store = new GeneratedMarketStore({
    cacheDirectory: defaultCacheDirectory,
    generateWorld: async () => {
      throw new Error("The committed Pune world should already be cached.");
    },
  });
  const adapters = createGeneratedMarketAdapters(store);
  const output = GeoQueryOutputSchema.parse(
    await adapters.geo.execute("geo.query", {
      query: "dental clinics",
      locality: "Pune",
      latitude: 0,
      longitude: 0,
      radiusKm: 30,
      limit: 20,
    }),
  );
  assert.ok(output.targets.length > 0);
  for (const target of output.targets) {
    assert.equal(target.kind, "organization");
    if (target.kind === "organization") {
      assert.match(target.payload.locality, /Pune/i);
    }
  }
});

test("artifact guard rejects findings before caching", async () => {
  const cacheDirectory = await mkdtemp(
    path.join(os.tmpdir(), "motion-grid-generated-invalid-"),
  );
  temporaryDirectories.push(cacheDirectory);
  const store = new GeneratedMarketStore({
    cacheDirectory,
    generateWorld: async () => ({ ...simWorld, finding: "prequalified" }),
  });
  await assert.rejects(
    store.worldFor({
      geography: "Mumbai",
      category: "pet groomers",
      limit: 10,
      seed: 20260808,
      latitude: 19.076,
      longitude: 72.8777,
    }),
    /cannot contain the key "finding"/,
  );
  assert.deepEqual(await readdir(cacheDirectory), []);
});
