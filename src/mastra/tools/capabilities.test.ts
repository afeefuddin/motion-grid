import assert from "node:assert/strict";
import test from "node:test";
import { RequestContext } from "@mastra/core/request-context";
import { noopObserve } from "@mastra/core/tools";
import type { Adapter } from "../../capabilities/adapter";
import type { ToolCallEntry, ToolCallWriter } from "../../capabilities/execute";
import type { CapabilityId } from "../../contracts/capabilities";
import { capabilityIds } from "../../contracts/enums";
import {
  capabilityToolNames,
  createAdsPlanTool,
  createDbQueryTool,
  createGeoQueryTool,
  createMessageSendTool,
  createPeopleFindTool,
  createReviewsFetchTool,
  createSegmentBuildTool,
  createWebFetchTool,
} from "./capabilities";

class CapturingLedger implements ToolCallWriter {
  entries = 0;
  capabilityId = "";

  async record<C extends CapabilityId>(entry: ToolCallEntry<C>): Promise<void> {
    this.entries += 1;
    this.capabilityId = entry.capabilityId;
  }
}

const geoAdapter: Adapter<"geo.query"> = {
  id: "test.geo",
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
    operatingCents: 0,
    commitCents: 0,
    projected: true,
  },
  async execute() {
    return { targets: [] };
  },
};

test("every capability has a provider-safe tool name", () => {
  assert.deepEqual(Object.keys(capabilityToolNames), [...capabilityIds]);
  assert.equal(
    [
      createGeoQueryTool,
      createDbQueryTool,
      createWebFetchTool,
      createReviewsFetchTool,
      createPeopleFindTool,
      createSegmentBuildTool,
      createMessageSendTool,
      createAdsPlanTool,
    ].length,
    capabilityIds.length,
  );
  for (const name of Object.values(capabilityToolNames)) {
    assert.match(name, /^[a-z0-9-]+$/);
  }
});

test("tool execution uses the validated and ledgered capability funnel", async () => {
  const ledger = new CapturingLedger();
  const tool = createGeoQueryTool({
    context: { campaignId: "campaign", runId: "run", targetId: null },
    binding: {
      capabilityId: "geo.query",
      adapterId: geoAdapter.id,
      mode: geoAdapter.mode,
    },
    adapter: geoAdapter,
    ledger,
  });
  if (tool.execute === undefined) {
    throw new Error("geo-query tool has no executor");
  }
  const output = await tool.execute(
    {
      query: "salons",
      latitude: 12.97,
      longitude: 77.64,
      radiusKm: 4,
      limit: 10,
    },
    { observe: noopObserve, requestContext: new RequestContext() },
  );

  assert.deepEqual(output, { targets: [] });
  assert.equal(ledger.entries, 1);
  assert.equal(ledger.capabilityId, "geo.query");
});
