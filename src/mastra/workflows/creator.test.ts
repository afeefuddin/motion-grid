import assert from "node:assert/strict";
import test from "node:test";
import type { Adapter } from "../../capabilities/adapter";
import type { Target } from "../../contracts";
import type { NewTarget } from "../../db/repositories";
import type { StructuredAgent } from "../agents/runner";
import { runCreatorMotion, shortlistCreators } from "./creator";
import type { OrganizationInput, OrganizationRuntime } from "./organization";
import { ReplanController } from "./replan";

const campaignId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";

const input = {
  workspaceName: "MotionGrid",
  campaignId,
  runId,
  spec: {
    name: "Beauty launch",
    goal: "Launch a skincare campaign with relevant beauty creators",
    geography: "Bengaluru",
    motions: ["creator"],
    targetCriteria: ["beauty", "skincare"],
    budget: {
      operating: { currency: "USD", amountMinor: 1_000 },
      commit: { currency: "INR", amountMinor: 5_000_000 },
    },
    channels: ["email"],
    successMetric: "Qualified creator partnerships",
  },
  plan: {
    campaignId,
    motions: [
      {
        motionId: "creator",
        capabilities: ["db.query"],
        operatingBudgetCents: 1_000,
        commitBudgetCents: 5_000_000,
        dependsOn: [],
        rationale: "Rank the creator database for campaign relevance.",
        bindings: [
          {
            capabilityId: "db.query",
            weights: {
              cost: 0.25,
              freshness: 0.25,
              confidence: 0.25,
              coverage: 0.25,
            },
            weightsRationale: "Balanced for the test.",
            candidates: [
              {
                adapterId: "creator.db",
                mode: "sim",
                dimensionScores: {
                  cost: 1,
                  freshness: 1,
                  confidence: 1,
                  coverage: 1,
                },
                totalScore: 1,
                eligible: true,
                reason: "Creator database is available.",
              },
            ],
            chosen: { adapterId: "creator.db", mode: "sim" },
          },
        ],
        declined: [],
      },
    ],
    policies: [],
    budget: {
      operating: { currency: "USD", amountMinor: 1_000 },
      commit: { currency: "INR", amountMinor: 5_000_000 },
    },
    declinedMotions: [],
    replanOf: null,
  },
} satisfies OrganizationInput;

function creator(externalRef: string, category: string) {
  return {
    kind: "person" as const,
    externalRef,
    name: `Creator ${externalRef}`,
    payload: {
      platform: "instagram",
      handle: `@${externalRef}`,
      followerCount: 20_000,
      rateCardCommitCents: 1_000_000,
      profile: {
        audienceGeography: { Bengaluru: 0.8, Other: 0.2 },
        audienceInterests: { [category]: 0.7 },
        contentCategories: [category],
        engagementRate: 0.04,
        viewToFollowerRatio: 0.5,
        fakeFollowerEstimate: 0.05,
        brandSafetyFlags: [],
      },
    },
  };
}

test("shortlist preserves Claude rank order and persisted creator profile tags", async () => {
  const candidates = [
    creator("creator-1", "lifestyle"),
    creator("creator-2", "skincare"),
    creator("creator-3", "beauty"),
  ];
  let suppliedCandidates = 0;
  const selector: StructuredAgent<{
    selected: Array<{
      externalRef: string;
      relevanceScore: number;
      reason: string;
    }>;
  }> = {
    async generate(prompt) {
      const payload = JSON.parse(prompt.slice(prompt.indexOf("\n") + 1));
      suppliedCandidates = payload.candidates.length;
      return {
        object: {
          selected: [
            {
              externalRef: "creator-3",
              relevanceScore: 0.96,
              reason: "Beauty content matches the campaign.",
            },
            {
              externalRef: "creator-2",
              relevanceScore: 0.91,
              reason: "Skincare content matches the campaign.",
            },
          ],
        },
      };
    },
  };

  const result = await shortlistCreators(input, candidates, selector);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(suppliedCandidates, candidates.length);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.externalRef),
    ["creator-3", "creator-2"],
  );
  assert.deepEqual(result.candidates[0]?.payload.profile?.contentCategories, [
    "beauty",
  ]);
  assert.equal(result.candidates[0]?.payload.selection?.relevanceScore, 0.96);
});

test("creator motion attaches only Claude's selected creators to the campaign", async () => {
  const discovered = [
    creator("creator-1", "lifestyle"),
    creator("creator-2", "skincare"),
    creator("creator-3", "beauty"),
  ];
  let queryInput: unknown;
  const adapter: Adapter<"db.query"> = {
    id: "creator.db",
    provides: ["db.query"],
    mode: "sim",
    unitCost: {
      unit: "record",
      operatingCents: 0,
      commitCents: 0,
      projected: true,
    },
    profile: {
      coverage: { geographies: ["*"], categories: ["*"] },
      freshnessDays: 0,
      expectedConfidence: 1,
      rateLimitPerMinute: null,
      writesExternalState: false,
      productionPath: "test",
    },
    async execute(_capabilityId, query) {
      queryInput = query;
      return { targets: discovered };
    },
  };
  const saved: NewTarget[] = [];
  const updated: string[] = [];
  const runtime = {
    store: {
      async saveTargets(targets: readonly NewTarget[]) {
        saved.push(...targets);
        return targets.map(
          (target, index) =>
            ({
              ...target,
              id: `10000000-0000-4000-8000-00000000000${index + 1}`,
              status: "discovered",
              createdAt: new Date("2026-08-08T00:00:00.000Z"),
              updatedAt: new Date("2026-08-08T00:00:00.000Z"),
            }) as Target,
        );
      },
      async updateTarget(targetId: string) {
        updated.push(targetId);
      },
      async saveSignals() {
        throw new Error("unused");
      },
      async saveAssessment() {
        throw new Error("unused");
      },
      async saveContact() {
        throw new Error("unused");
      },
      async saveMessage() {
        throw new Error("unused");
      },
      async saveApproval() {
        throw new Error("unused");
      },
    },
    agents: {
      selectCreators: {
        async generate() {
          return {
            object: {
              selected: [
                {
                  externalRef: "creator-3",
                  relevanceScore: 0.97,
                  reason: "Beauty tags match.",
                },
                {
                  externalRef: "creator-2",
                  relevanceScore: 0.92,
                  reason: "Skincare tags match.",
                },
              ],
            },
          };
        },
      },
      extract: {
        async generate() {
          throw new Error("unused");
        },
      },
      assess: {
        async generate() {
          throw new Error("unused");
        },
      },
      draft: {
        async generate() {
          throw new Error("unused");
        },
      },
    },
    adapters: { geo: [], db: [adapter], web: [], reviews: [], people: [] },
    ledger: { async record() {} },
    events: { async emit() {} },
    replans: new ReplanController({
      campaignId,
      runId,
      events: { async emit() {} },
      replanner: {
        async replan(request) {
          return request.plan;
        },
      },
    }),
  } satisfies OrganizationRuntime;

  const result = await runCreatorMotion(input, runtime, [adapter]);

  assert.deepEqual(queryInput, {
    entityKind: "creator",
    filters: {},
    limit: 100,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    saved.map((target) => [target.campaignId, target.externalRef]),
    [
      [campaignId, "creator-3"],
      [campaignId, "creator-2"],
    ],
  );
  assert.deepEqual(
    saved[0]?.kind === "person"
      ? saved[0].payload.profile?.contentCategories
      : undefined,
    ["beauty"],
  );
  assert.equal(updated.length, 2);
  assert.equal(result.targetIds.length, 2);
});
