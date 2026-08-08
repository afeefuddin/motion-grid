import assert from "node:assert/strict";
import test from "node:test";
import { Mastra } from "@mastra/core/mastra";
import { InMemoryStore } from "@mastra/core/storage";
import type { Adapter } from "../../capabilities";
import { createCampaignWorkflow } from "./composition";
import type { PlanData } from "./replan";
import { ReplanController } from "./replan";

const campaignId = "ef08bd1f-c238-4bed-9b2d-05a737d0f8e4";
const runId = "b4a79be8-527a-410b-bb87-c9b76a796003";
const planId = "82f408d3-1738-44a7-a41c-404182febfa9";
const workspaceId = "ba2f36e5-2d81-4c53-8156-dda0a701a769";

const spec = {
  name: "Local growth",
  goal: "Find Bengaluru salons with booking gaps.",
  geography: "Bengaluru",
  motions: ["business.local", "consumer.ads"],
  targetCriteria: ["salon"],
  budget: {
    operating: { currency: "USD", amountMinor: 100 },
    commit: { currency: "INR", amountMinor: 0 },
  },
  channels: ["whatsapp"],
  successMetric: "Qualified meetings",
} satisfies Parameters<
  Parameters<typeof createCampaignWorkflow>[0]["planCampaign"]
>[0]["spec"];

const plan: PlanData = {
  campaignId,
  motions: [
    {
      motionId: "business.local",
      capabilities: ["geo.query"],
      operatingBudgetCents: 100,
      commitBudgetCents: 0,
      dependsOn: [],
      rationale: "Use the connected simulation source.",
      bindings: [
        {
          capabilityId: "geo.query",
          weights: {
            cost: 0.25,
            freshness: 0.25,
            confidence: 0.25,
            coverage: 0.25,
          },
          weightsRationale: "Balanced for the test.",
          candidates: [
            {
              adapterId: "empty.geo",
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
          chosen: { adapterId: "empty.geo", mode: "sim" },
        },
      ],
      declined: [],
    },
  ],
  policies: [],
  budget: spec.budget,
  declinedMotions: [
    { motionId: "consumer.ads", reason: "No first-party data source." },
  ],
  replanOf: null,
};

const emptyGeo: Adapter<"geo.query"> = {
  id: "empty.geo",
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

test("approval suspends durably and a failed creator motion does not abort synthesis", async () => {
  const workflow = createCampaignWorkflow({
    async compileObjective() {
      return spec;
    },
    async planCampaign() {
      return plan;
    },
    businessRuntime() {
      return {
        store: {
          async saveTargets() {
            return [];
          },
          async saveSignals() {
            return [];
          },
          async saveAssessment() {},
          async saveContact() {
            throw new Error("No target should request a contact.");
          },
          async saveMessage() {
            throw new Error("No target should request a message.");
          },
          async updateTarget() {},
        },
        agents: {
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
        adapters: { geo: [emptyGeo], web: [], reviews: [], people: [] },
        ledger: { async record() {} },
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
      };
    },
    async runCreator() {
      throw new Error("creator fixture failed");
    },
    async recordPlanDecision(input) {
      assert.equal(input.approved, true);
    },
    async synthesize(input) {
      assert.deepEqual(input.targetIds, []);
      return {
        edges: [],
        outcome: {
          targetCount: 0,
          fitCount: 0,
          sentCount: 0,
          engagedCount: 0,
          operatingSpentCents: 0,
          commitSpentCents: 0,
        },
      };
    },
  });
  const mastra = new Mastra({
    storage: new InMemoryStore({ id: "workflow-test" }),
    workflows: { campaignWorkflow: workflow },
  });
  const run = await mastra.getWorkflow("campaignWorkflow").createRun();
  const suspended = await run.start({
    inputData: {
      workspaceId,
      campaignId,
      runId,
      planId,
      workspaceName: "MotionGrid",
      objective: "Find local businesses.",
      budget: spec.budget,
    },
  });
  assert.equal(suspended.status, "suspended");

  const completed = await run.resume({
    step: "approval-gate",
    resumeData: {
      approved: true,
      reviewerId: "62dd4187-ee13-4ec4-83c8-7e850763a9e8",
    },
  });
  assert.equal(completed.status, "success");
  if (completed.status === "success") {
    assert.equal(completed.result.outcome.targetCount, 0);
  }
});
