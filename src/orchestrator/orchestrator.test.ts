import assert from "node:assert/strict";
import test from "node:test";
import type { StructuredAgent } from "../mastra/agents/runner";
import { planCampaign, replanCampaign } from "./plan";
import { rankAdapters } from "./rank";
import type {
  CampaignSpec,
  RankingAdapter,
  RankingRequest,
  RankingWeightProposal,
} from "./types";
import { deriveRankingWeights } from "./weights";

const campaignId = "00000000-0000-4000-8000-000000000001";
const planId = "00000000-0000-4000-8000-000000000002";

const spec: CampaignSpec = {
  name: "Bengaluru growth",
  goal: "Find local businesses with booking-flow gaps and relevant creators",
  geography: "Bengaluru",
  motions: [
    "consumer.ads",
    "business.online",
    "consumer.email",
    "business.local",
    "creator",
  ],
  targetCriteria: ["booking-flow gaps", "beauty creators"],
  budget: {
    operating: { currency: "USD", amountMinor: 1000 },
    commit: { currency: "INR", amountMinor: 100_000 },
  },
  channels: ["whatsapp", "email"],
  successMetric: "Qualified meetings and creator partnerships",
};

class SequenceAgent implements StructuredAgent<RankingWeightProposal> {
  calls = 0;

  constructor(private readonly outputs: readonly RankingWeightProposal[]) {}

  async generate(): Promise<{ object: RankingWeightProposal }> {
    const object = this.outputs[this.calls];
    if (object === undefined) {
      throw new Error("The test agent has no response for this call.");
    }
    this.calls += 1;
    return { object };
  }
}

function adapter(
  id: string,
  capabilityId: RankingAdapter["provides"][number],
  operatingCents: number,
  freshnessDays: number,
  expectedConfidence: number,
  rateLimitPerMinute: number | null = null,
): RankingAdapter {
  return {
    id,
    provides: [capabilityId],
    mode: id.startsWith("sim") ? "sim" : "live",
    unitCost: {
      unit:
        capabilityId === "geo.query" || capabilityId === "db.query"
          ? "record"
          : "request",
      operatingCents,
      commitCents: 0,
      projected: true,
    },
    profile: {
      coverage: { geographies: ["Bengaluru"], categories: ["*"] },
      freshnessDays,
      expectedConfidence,
      rateLimitPerMinute,
      writesExternalState: false,
      productionPath: id,
    },
  };
}

const validProposal: RankingWeightProposal = {
  weights: { cost: 0.05, freshness: 0.45, confidence: 0.4, coverage: 0.1 },
  weightsRationale:
    "Freshness and confidence matter most for current evidence.",
};

const planningAdapters: readonly RankingAdapter[] = [
  adapter("sim.geo", "geo.query", 0, 30, 0.5),
  adapter("live.geo", "geo.query", 10, 0, 1),
  adapter("sim.db", "db.query", 0, 0, 0.9),
  adapter("sim.web", "web.fetch", 0, 0, 1),
  adapter("sim.reviews", "reviews.fetch", 0, 0, 1),
];

test("pure ranking retains losers, ineligible candidates, and stable tie ordering", () => {
  const adapters = [
    adapter("zeta", "geo.query", 0, 0, 0.8),
    adapter("alpha", "geo.query", 0, 0, 0.8),
    adapter("limited", "geo.query", 0, 0, 1, 2),
  ];
  const request: RankingRequest = {
    capabilityId: "geo.query",
    adapters,
    weights: { cost: 0.25, freshness: 0.25, confidence: 0.25, coverage: 0.25 },
    geography: "Bengaluru",
    categories: ["beauty"],
    requiredThroughputPerMinute: 10,
  };
  const first = rankAdapters(request);
  const second = rankAdapters(request);

  assert.deepEqual(second, first);
  assert.equal(first.ok, true);
  if (!first.ok) {
    return;
  }
  assert.deepEqual(
    first.candidates.map((candidate) => candidate.adapterId),
    ["limited", "alpha", "zeta"],
  );
  assert.equal(first.candidates.length, adapters.length);
  const limited = first.candidates[0];
  assert.ok(limited);
  assert.equal(limited.eligible, false);
  assert.match(limited.reason, /Rate limit/);
});

test("malformed model weights are rejected and retried without normalization", async () => {
  const malformed: RankingWeightProposal = {
    weights: { cost: 0.5, freshness: 0.5, confidence: 0.5, coverage: 0.5 },
    weightsRationale: "Invalid on purpose.",
  };
  const recovers = new SequenceAgent([malformed, validProposal]);
  const recovered = await deriveRankingWeights(spec, recovers);
  assert.equal(recovered.ok, true);
  assert.equal(recovers.calls, 2);
  if (recovered.ok) {
    assert.deepEqual(recovered.weights, validProposal.weights);
  }

  const rejects = new SequenceAgent([malformed, malformed]);
  const rejected = await deriveRankingWeights(spec, rejects);
  assert.equal(rejected.ok, false);
  assert.equal(rejects.calls, 2);
  if (!rejected.ok) {
    assert.match(rejected.reason, /sum to 1/);
  }
});

test("planning declines unsupported motions and records every ranked candidate", async () => {
  const result = await planCampaign(
    { campaignId, spec },
    {
      adapters: planningAdapters,
      weightsAgent: new SequenceAgent([validProposal]),
    },
  );
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.deepEqual(
    result.data.motions.map((motion) => motion.motionId),
    ["business.local", "creator"],
  );
  assert.deepEqual(
    result.data.declinedMotions.map((motion) => motion.motionId),
    ["consumer.ads", "business.online", "consumer.email"],
  );
  const firstDecline = result.data.declinedMotions[0];
  assert.ok(firstDecline);
  assert.equal(
    firstDecline.reason,
    "no first-party customer data source is connected; segment.build has no warehouse to build from",
  );
  const local = result.data.motions[0];
  assert.ok(local);
  const geo = local.bindings.find(
    (binding) => binding.capabilityId === "geo.query",
  );
  assert.ok(geo);
  assert.equal(geo.candidates.length, 2);
  assert.equal(geo.chosen.adapterId, "live.geo");
  const declined = local.declined[0];
  assert.ok(declined);
  assert.equal(declined.capabilityId, "people.find");
  assert.match(local.rationale, /descending assessment score/);
});

test("budget refusal re-plans to the cheaper adapter and the cap stops loops", async () => {
  const initial = await planCampaign(
    { campaignId, spec },
    {
      adapters: planningAdapters,
      weightsAgent: new SequenceAgent([validProposal]),
    },
  );
  assert.equal(initial.ok, true);
  if (!initial.ok) {
    return;
  }

  const replanned = await replanCampaign(
    {
      replacedPlanId: planId,
      previousPlan: initial.data,
      spec,
      refusal: {
        trigger: "operating_budget_denied",
        reason: "The reduced operating budget cannot fund the paid provider.",
      },
      replanCount: 0,
    },
    { adapters: planningAdapters },
  );
  assert.equal(replanned.ok, true);
  if (!replanned.ok) {
    return;
  }
  const local = replanned.data.motions[0];
  assert.ok(local);
  const geo = local.bindings.find(
    (binding) => binding.capabilityId === "geo.query",
  );
  assert.ok(geo);
  assert.equal(geo.chosen.adapterId, "sim.geo");
  const replanOf = replanned.data.replanOf;
  assert.ok(replanOf);
  assert.equal(replanOf.planId, planId);

  const capped = await replanCampaign({
    replacedPlanId: planId,
    previousPlan: replanned.data,
    spec,
    refusal: {
      trigger: "operating_budget_denied",
      reason: "Budget denied again.",
    },
    replanCount: 2,
  });
  assert.equal(capped.ok, false);
  if (!capped.ok) {
    assert.match(capped.reason, /at most 2/);
  }
});

test("an unavailable binding remains visible but cannot win its re-plan", async () => {
  const initial = await planCampaign(
    { campaignId, spec },
    {
      adapters: planningAdapters,
      weightsAgent: new SequenceAgent([validProposal]),
    },
  );
  assert.equal(initial.ok, true);
  if (!initial.ok) {
    return;
  }
  const replanned = await replanCampaign(
    {
      replacedPlanId: planId,
      previousPlan: initial.data,
      spec,
      refusal: {
        trigger: "binding_unavailable",
        reason: "The paid geo adapter was disconnected.",
        capabilityId: "geo.query",
        adapterId: "live.geo",
      },
      replanCount: 0,
    },
    { adapters: planningAdapters },
  );
  assert.equal(replanned.ok, true);
  if (!replanned.ok) {
    return;
  }
  const local = replanned.data.motions[0];
  assert.ok(local);
  const geo = local.bindings.find(
    (binding) => binding.capabilityId === "geo.query",
  );
  assert.ok(geo);
  assert.equal(geo.chosen.adapterId, "sim.geo");
  assert.equal(geo.candidates.length, 2);
  const unavailable = geo.candidates.find(
    (candidate) => candidate.adapterId === "live.geo",
  );
  assert.ok(unavailable);
  assert.equal(unavailable.eligible, false);
});
