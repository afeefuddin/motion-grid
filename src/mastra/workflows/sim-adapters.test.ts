import assert from "node:assert/strict";
import test from "node:test";
import { executeCapability } from "../../capabilities/execute";
import { capabilityRegistry } from "../../capabilities/registry";
import { geoSimAdapter } from "./sim-adapters";

test("executes geo.query through the capability funnel and awaits its ledger", async () => {
  const entries: string[] = [];
  const output = await executeCapability({
    context: {
      campaignId: "ef08bd1f-c238-4bed-9b2d-05a737d0f8e4",
      runId: "b4a79be8-527a-410b-bb87-c9b76a796003",
      targetId: null,
    },
    capability: capabilityRegistry["geo.query"],
    binding: {
      capabilityId: "geo.query",
      adapterId: geoSimAdapter.id,
      mode: "sim",
    },
    adapter: geoSimAdapter,
    input: {
      query: "salon spa",
      latitude: 12.9716,
      longitude: 77.5946,
      radiusKm: 30,
      limit: 60,
    },
    ledger: {
      async record(entry) {
        await Promise.resolve();
        entries.push(entry.adapterId);
      },
    },
  });

  assert.equal(output.targets.length, 10);
  assert.deepEqual(entries, ["market.geo"]);
});
