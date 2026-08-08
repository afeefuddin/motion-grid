import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityId } from "../contracts/capabilities";
import type { Adapter } from "./adapter";
import { bindCapability, resolveBinding } from "./binding";
import {
  executeCapability,
  type ToolCallEntry,
  type ToolCallWriter,
} from "./execute";
import { capabilityRegistry } from "./registry";

const geoAdapter: Adapter<"geo.query"> = {
  id: "market.geo",
  provides: ["geo.query"],
  mode: "sim",
  profile: {
    coverage: { geographies: ["*"], categories: ["*"] },
    freshnessDays: 0,
    expectedConfidence: 1,
    rateLimitPerMinute: null,
    writesExternalState: false,
    productionPath: "Google Places",
  },
  unitCost: {
    unit: "record",
    operatingCents: 0.3,
    commitCents: 0,
    projected: true,
  },
  async execute() {
    return { targets: [] };
  },
};

class CapturingWriter implements ToolCallWriter {
  count = 0;
  adapterId = "";

  async record<C extends CapabilityId>(entry: ToolCallEntry<C>): Promise<void> {
    this.count += 1;
    this.adapterId = entry.adapterId;
  }
}

test("binding is deterministic and persisted bindings never fall back", () => {
  const second: Adapter<"geo.query"> = { ...geoAdapter, id: "z.geo" };
  const first: Adapter<"geo.query"> = { ...geoAdapter, id: "a.geo" };
  const result = bindCapability("geo.query", [second, first], ["sim"]);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.equal(result.binding.adapterId, "a.geo");
  assert.equal(resolveBinding(result.binding, [second]).ok, false);
});

test("capability execution validates and records through one funnel", async () => {
  const ledger = new CapturingWriter();
  const output = await executeCapability({
    context: { campaignId: "campaign-1", runId: "run-1", targetId: null },
    capability: capabilityRegistry["geo.query"],
    binding: {
      capabilityId: "geo.query",
      adapterId: "market.geo",
      mode: "sim",
    },
    adapter: geoAdapter,
    input: {
      query: "salon",
      latitude: 12,
      longitude: 77,
      radiusKm: 5,
      limit: 10,
    },
    ledger,
    now: () => 10,
  });
  assert.deepEqual(output, { targets: [] });
  assert.equal(ledger.count, 1);
  assert.equal(ledger.adapterId, "market.geo");
});

test("registry contains all frozen capability contracts", () => {
  assert.deepEqual(Object.keys(capabilityRegistry).sort(), [
    "ads.plan",
    "db.query",
    "geo.query",
    "message.send",
    "people.find",
    "reviews.fetch",
    "segment.build",
    "web.fetch",
  ]);
});
