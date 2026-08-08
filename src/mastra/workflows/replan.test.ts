import assert from "node:assert/strict";
import test from "node:test";
import type { Adapter } from "../../capabilities";
import { capabilityRegistry } from "../../capabilities";
import { evaluateOperatingBudget } from "./policy";
import type { PlanData } from "./replan";
import { executePlannedCapability, ReplanController } from "./replan";

const plan: PlanData = {
  campaignId: "ef08bd1f-c238-4bed-9b2d-05a737d0f8e4",
  motions: [
    {
      motionId: "business.local",
      capabilities: ["geo.query"],
      operatingBudgetCents: 100,
      commitBudgetCents: 0,
      dependsOn: [],
      rationale: "Discover local businesses.",
      bindings: [],
      declined: [],
    },
  ],
  policies: [],
  suggestedActions: [],
  budget: {
    operating: { currency: "USD", amountMinor: 100 },
    commit: { currency: "INR", amountMinor: 0 },
  },
  declinedMotions: [
    {
      motionId: "consumer.ads",
      reason: "Advertising is declined at plan time.",
    },
  ],
  replanOf: null,
};

test("caps re-planning after two attempts and preserves completed targets", async () => {
  const events: string[] = [];
  const snapshots: (readonly string[])[] = [];
  const controller = new ReplanController({
    campaignId: plan.campaignId,
    runId: "b4a79be8-527a-410b-bb87-c9b76a796003",
    events: {
      async emit(event) {
        events.push(event.type);
      },
    },
    replanner: {
      async replan(request) {
        snapshots.push(request.completedTargetIds);
        return request.plan;
      },
    },
  });
  controller.completeTarget("6ce87ed0-22d6-4fd5-a34d-2f043919b5a0");

  assert.equal(
    (await controller.request(plan, "binding_unavailable", "one")).ok,
    true,
  );
  assert.equal(
    (await controller.request(plan, "operating_budget_cap", "two")).ok,
    true,
  );
  const third = await controller.request(plan, "binding_unavailable", "three");

  assert.equal(third.ok, false);
  if (!third.ok) {
    assert.match(third.reason, /limit reached after two attempts/i);
  }
  assert.deepEqual(events, [
    "replan_started",
    "replan_completed",
    "replan_started",
    "replan_completed",
    "replan_exhausted",
  ]);
  assert.deepEqual(snapshots, [
    ["6ce87ed0-22d6-4fd5-a34d-2f043919b5a0"],
    ["6ce87ed0-22d6-4fd5-a34d-2f043919b5a0"],
  ]);
});

test("an unavailable binding re-plans and executes the replacement through the funnel", async () => {
  const replacement: Adapter<"geo.query"> = {
    id: "replacement.geo",
    provides: ["geo.query"],
    mode: "sim",
    unitCost: {
      unit: "record",
      operatingCents: 0,
      commitCents: 0,
      projected: true,
    },
    profile: {
      coverage: { geographies: ["Bengaluru"], categories: ["*"] },
      freshnessDays: 0,
      expectedConfidence: 1,
      rateLimitPerMinute: null,
      writesExternalState: false,
      productionPath: "test",
    },
    async execute() {
      return { targets: [] };
    },
  };
  const reboundPlan: PlanData = {
    ...plan,
    motions: plan.motions.map((motion) => ({
      ...motion,
      bindings: [
        {
          capabilityId: "geo.query",
          weights: {
            cost: 0.25,
            freshness: 0.25,
            confidence: 0.25,
            coverage: 0.25,
          },
          weightsRationale: "Replacement binding.",
          candidates: [
            {
              adapterId: replacement.id,
              mode: "sim",
              dimensionScores: {
                cost: 1,
                freshness: 1,
                confidence: 1,
                coverage: 1,
              },
              totalScore: 1,
              eligible: true,
              reason: "Available.",
            },
          ],
          chosen: { adapterId: replacement.id, mode: "sim" },
        },
      ],
    })),
  };
  const events: string[] = [];
  const controller = new ReplanController({
    campaignId: plan.campaignId,
    runId: "b4a79be8-527a-410b-bb87-c9b76a796003",
    events: {
      async emit(event) {
        events.push(event.type);
      },
    },
    replanner: {
      async replan() {
        return reboundPlan;
      },
    },
  });
  const recorded: string[] = [];
  const result = await executePlannedCapability({
    capabilityId: "geo.query",
    capability: capabilityRegistry["geo.query"],
    input: {
      query: "salon",
      latitude: 12.9716,
      longitude: 77.5946,
      radiusKm: 30,
      limit: 60,
    },
    plan,
    adapters: [replacement],
    context: {
      campaignId: plan.campaignId,
      runId: "b4a79be8-527a-410b-bb87-c9b76a796003",
      targetId: null,
    },
    ledger: {
      async record(entry) {
        recorded.push(entry.adapterId);
      },
    },
    replans: controller,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(events, ["replan_started", "replan_completed"]);
  assert.deepEqual(recorded, ["replacement.geo"]);
});

test("an operating-budget denial re-plans before the refused action", async () => {
  const events: string[] = [];
  const controller = new ReplanController({
    campaignId: plan.campaignId,
    runId: "b4a79be8-527a-410b-bb87-c9b76a796003",
    events: {
      async emit(event) {
        events.push(event.type);
      },
    },
    replanner: {
      async replan(request) {
        return request.plan;
      },
    },
  });
  const result = await evaluateOperatingBudget({
    plan,
    budgetCents: 100,
    spentCents: 99,
    proposedCents: 1,
    replans: controller,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(events, ["replan_started", "replan_completed"]);
});
