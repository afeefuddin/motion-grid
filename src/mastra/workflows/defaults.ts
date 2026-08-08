import { eq } from "drizzle-orm";
import {
  generatedMarketDbAdapter,
  generatedMarketPeopleAdapter,
  generatedMarketReviewsAdapter,
  generatedMarketWebAdapter,
} from "../../adapters/generated";
import {
  generatedMarketGeoCatalogAdapter,
  marketGeoCatalogAdapter,
  marketPeopleCatalogAdapter,
  marketReviewsCatalogAdapter,
  marketWebCatalogAdapter,
} from "../../adapters/catalog";
import type { ToolCallWriter } from "../../capabilities";
import { PlanDataSchema } from "../../contracts";
import { db } from "../../db/client";
import {
  assessmentRepo,
  allocationRepo,
  approvalRepo,
  campaignConversationMessageRepo,
  campaignRepo,
  contactRepo,
  messageRepo,
  planRepo,
  runRepo,
  signalRepo,
  targetRepo,
  toolCallRepo,
} from "../../db/repositories";
import { campaign, objective } from "../../db/schema";
import {
  defaultRankingAdapters,
  planCampaign,
  rankAdapters,
} from "../../orchestrator";
import { synthesizeStep } from "../../synthesis";
import {
  assessor,
  creatorSelector,
  drafter,
  evidenceExtractor,
  locationFinder,
  runObjectiveCompiler,
} from "../agents";
import {
  type CampaignWorkflowInput,
  type CampaignWorkflowServices,
  createCampaignWorkflow,
} from "./composition";
import { runCreatorMotion } from "./creator";
import {
  createOrchestratorReplanner,
  ReplanController,
  type WorkflowEventSink,
} from "./replan";
import {
  dbSimAdapter,
  geoSimAdapter,
  peopleSimAdapter,
  reviewsSimAdapter,
  segmentSimAdapter,
  webSimAdapter,
} from "./sim-adapters";

const repositoryStore = {
  saveTargets: (targets: Parameters<typeof targetRepo.bulkUpsert>[0]) =>
    targetRepo.bulkUpsert([...targets]),
  saveSignals: (signals: Parameters<typeof signalRepo.bulkCreate>[0]) =>
    signalRepo.bulkCreate([...signals]),
  async saveAllocation(allocation: Parameters<typeof allocationRepo.create>[0]) {
    await allocationRepo.create(allocation);
  },
  async saveAssessment(
    assessment: Parameters<typeof assessmentRepo.create>[0],
  ) {
    await assessmentRepo.create(assessment);
  },
  saveContact: contactRepo.create,
  saveMessage: messageRepo.create,
  saveApproval: approvalRepo.create,
  async updateTarget(
    targetId: Parameters<typeof targetRepo.updateState>[0],
    status: Parameters<typeof targetRepo.updateState>[1],
  ) {
    await targetRepo.updateState(targetId, status);
  },
};

const repositoryLedger: ToolCallWriter = {
  async record(entry) {
    await toolCallRepo.create(entry);
  },
};

const silentEvents: WorkflowEventSink = {
  async emit() {
    await Promise.resolve();
  },
};

function activateDeferredContactBindings(
  plan: Awaited<ReturnType<CampaignWorkflowServices["planCampaign"]>>,
  geography: string,
) {
  return PlanDataSchema.parse({
    ...plan,
    motions: plan.motions.map((motion) => {
      const deferred = motion.declined.find(
        (capability) => capability.capabilityId === "people.find",
      );
      const weights = motion.bindings.find(() => true);
      if (deferred === undefined || weights === undefined) {
        return motion;
      }
      const ranking = rankAdapters({
        capabilityId: "people.find",
        adapters: defaultRankingAdapters,
        weights: weights.weights,
        geography,
        categories: ["*"],
        requiredThroughputPerMinute: 1,
      });
      if (!ranking.ok) {
        throw new Error(ranking.reason);
      }
      const winner = ranking.candidates.find((candidate) => candidate.eligible);
      if (winner === undefined) {
        throw new Error("No eligible people.find adapter is available.");
      }
      return {
        ...motion,
        capabilities: [...motion.capabilities, "people.find"],
        bindings: [
          ...motion.bindings,
          {
            capabilityId: "people.find",
            weights: weights.weights,
            weightsRationale: weights.weightsRationale,
            candidates: ranking.candidates,
            chosen: { adapterId: winner.adapterId, mode: winner.mode },
          },
        ],
        declined: motion.declined.filter(
          (capability) => capability.capabilityId !== "people.find",
        ),
      };
    }),
  });
}

/** Creates production workflow services while allowing T7 to provide its SSE sink. */
export function createDefaultWorkflowServices(
  events: WorkflowEventSink = silentEvents,
): CampaignWorkflowServices {
  const runtimes = new Map<
    string,
    ReturnType<CampaignWorkflowServices["businessRuntime"]>
  >();
  return {
    async compileObjective(input) {
      const result = await runObjectiveCompiler(input);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      return result.data;
    },
    async planCampaign(input) {
      const result = await planCampaign({
        campaignId: input.campaignId,
        spec: input.spec,
        connectedSources: input.connectedSources,
      });
      if (!result.ok) {
        throw new Error(result.reason);
      }
      const planned = activateDeferredContactBindings(
        result.data,
        input.spec.geography,
      );
      const previous = await planRepo.latestByCampaign(input.campaignId);
      await planRepo.create(
        {
          id: input.planId,
          campaignId: input.campaignId,
          version:
            previous === undefined || previous === null
              ? 1
              : previous.version + 1,
          status: "approved",
          spec: planned,
        },
        planned.motions.map((motion) => ({
          planId: input.planId,
          campaignId: input.campaignId,
          motionId: motion.motionId,
          operatingBudgetCents: motion.operatingBudgetCents,
          commitBudgetCents: motion.commitBudgetCents,
          dependsOn: motion.dependsOn,
        })),
      );
      await runRepo.attachPlan(input.runId, input.planId);
      return planned;
    },
    async recordCompiledSpec(input) {
      await db.transaction(async (transaction) => {
        await transaction
          .update(campaign)
          .set({
            name: input.name,
            operatingBudgetCents: input.budget.operating.amountMinor,
            commitBudgetCents: input.budget.commit.amountMinor,
            updatedAt: new Date(),
          })
          .where(eq(campaign.id, input.campaignId));
        await transaction
          .update(objective)
          .set({ compiledSpec: input.spec, updatedAt: new Date() })
          .where(eq(objective.campaignId, input.campaignId));
      });
    },
    businessRuntime(input, runtimeEvents = events) {
      const existing = runtimes.get(input.runId);
      if (existing !== undefined) {
        existing.replans.setEvents(runtimeEvents);
        existing.events = runtimeEvents;
        return existing;
      }
      const runtime = {
        store: repositoryStore,
        agents: {
          locationFinder,
          extract: evidenceExtractor,
          assess: assessor,
          draft: drafter,
          selectCreators: creatorSelector,
        },
        adapters: {
          geo: [marketGeoCatalogAdapter, generatedMarketGeoCatalogAdapter],
          generatedGeo: generatedMarketGeoCatalogAdapter,
          db: [dbSimAdapter, generatedMarketDbAdapter],
          web: [marketWebCatalogAdapter, generatedMarketWebAdapter],
          reviews: [
            marketReviewsCatalogAdapter,
            generatedMarketReviewsAdapter,
          ],
          people: [marketPeopleCatalogAdapter, generatedMarketPeopleAdapter],
        },
        ledger: repositoryLedger,
        events: runtimeEvents,
        replans: new ReplanController({
          campaignId: input.campaignId,
          runId: input.runId,
          events: runtimeEvents,
          replanner: createOrchestratorReplanner({
            replacedPlanId: input.planId,
            spec: input.spec,
            adapters: defaultRankingAdapters,
          }),
        }),
      };
      runtimes.set(input.runId, runtime);
      return runtime;
    },
    async runCreator(input) {
      return runCreatorMotion(input, this.businessRuntime(input), [
        dbSimAdapter,
        generatedMarketDbAdapter,
      ]);
    },
    async synthesize(input) {
      const result = await synthesizeStep(input);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      await runRepo.complete(input.runId);
      await campaignRepo.updateStatus(input.campaignId, "completed");
      await campaignConversationMessageRepo.updateAssistantForRun(
        input.runId,
        "completed",
        "The run is complete. The campaign artifact now includes the latest verified results.",
      );
      return result.data;
    },
    async recordFailure(input) {
      await runRepo.fail(input.runId, input.reason);
      await campaignRepo.updateStatus(input.campaignId, "failed");
      await campaignConversationMessageRepo.updateAssistantForRun(
        input.runId,
        "failed",
        `I couldn’t finish this change: ${input.reason}`,
      );
    },
  };
}

export function createDefaultCampaignWorkflow(events?: WorkflowEventSink) {
  return createCampaignWorkflow(createDefaultWorkflowServices(events));
}

export const executableSimulationAdapters = {
  geo: geoSimAdapter,
  db: dbSimAdapter,
  web: webSimAdapter,
  reviews: reviewsSimAdapter,
  people: peopleSimAdapter,
  segment: segmentSimAdapter,
};

export type { CampaignWorkflowInput };
