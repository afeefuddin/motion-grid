import { type Adapter, bindCapability } from "../capabilities";
import type { CapabilityId } from "../contracts/capabilities";
import {
  PlanDataSchema,
  PlanInputSchema,
  RankingWeightsSchema,
} from "../contracts/steps";
import type { StructuredAgent } from "../mastra/agents/runner";
import { getMotion } from "../motions";
import type { MotionId } from "../motions/types";
import { defaultRankingAdapters } from "./adapters";
import { rankAdapters } from "./rank";
import type {
  CampaignSpec,
  OrchestratorResult,
  PlanData,
  RankingAdapter,
  RankingWeightProposal,
  RankingWeights,
} from "./types";
import { deriveRankingWeights } from "./weights";

const NO_CUSTOMER_DATA_REASON =
  "no first-party customer data source is connected; segment.build has no warehouse to build from";
const MAX_REPLANS = 2;

export interface PlanCampaignOptions {
  readonly adapters?: readonly RankingAdapter[];
  readonly weightsAgent?: StructuredAgent<RankingWeightProposal>;
  readonly requiredThroughputPerMinute?: number;
}

export interface ReplanRefusal {
  readonly trigger: "binding_unavailable" | "operating_budget_denied";
  readonly reason: string;
  readonly capabilityId?: CapabilityId;
  readonly adapterId?: string;
}

export interface ReplanCampaignInput {
  readonly replacedPlanId: string;
  readonly previousPlan: PlanData;
  readonly spec: CampaignSpec;
  readonly refusal: ReplanRefusal;
  readonly replanCount: number;
}

export interface ReplanCampaignOptions {
  readonly adapters?: readonly RankingAdapter[];
  readonly requiredThroughputPerMinute?: number;
}

interface BuildPlanInput {
  readonly campaignId: string;
  readonly spec: CampaignSpec;
  readonly adapters: readonly RankingAdapter[];
  readonly weights: RankingWeights;
  readonly weightsRationale: string;
  readonly requiredThroughputPerMinute: number;
  readonly replanOf: PlanData["replanOf"];
  readonly refusal?: ReplanRefusal;
}

function cannotExecute(): Promise<never> {
  return Promise.reject(
    new Error("Ranking descriptors cannot execute capabilities."),
  );
}

function bindWinner<C extends CapabilityId>(
  capabilityId: C,
  adapter: RankingAdapter,
):
  | {
      readonly ok: true;
      readonly adapterId: string;
      readonly mode: RankingAdapter["mode"];
    }
  | { readonly ok: false; readonly reason: string } {
  const descriptor: Adapter<C> = {
    id: adapter.id,
    provides: [capabilityId],
    mode: adapter.mode,
    // Binding only reads identity, mode, and provided capabilities. Cost stays in ranking metadata.
    get unitCost(): never {
      throw new Error(
        "Ranking descriptors do not expose executable unit costs.",
      );
    },
    profile: adapter.profile,
    execute: cannotExecute,
  };
  const result = bindCapability(capabilityId, [descriptor], [adapter.mode]);
  return result.ok
    ? {
        ok: true,
        adapterId: result.binding.adapterId,
        mode: result.binding.mode,
      }
    : result;
}

function declineReason(motionId: MotionId): string | null {
  switch (motionId) {
    case "consumer.ads":
      return NO_CUSTOMER_DATA_REASON;
    case "consumer.email":
      return "no first-party customer data source is connected; customer_base cannot be resolved";
    case "business.online":
      return "no first-party company data source is connected; db.query has no connected company index";
    case "business.local":
    case "creator":
      return null;
  }
}

function capabilitiesForMotion(motionId: MotionId): readonly CapabilityId[] {
  const motion = getMotion(motionId);
  return [...motion.discovery, ...motion.observation];
}

function requestedCategories(
  spec: CampaignSpec,
  adapters: readonly RankingAdapter[],
): string[] {
  const objective = [spec.goal, ...spec.targetCriteria]
    .join(" ")
    .toLocaleLowerCase("en-IN");
  const categories = new Set<string>();
  for (const adapter of adapters) {
    for (const category of adapter.profile.coverage.categories) {
      if (
        category !== "*" &&
        objective.includes(category.toLocaleLowerCase("en-IN"))
      ) {
        categories.add(category);
      }
    }
  }
  return [...categories].sort((left, right) => {
    if (left === right) {
      return 0;
    }
    return left < right ? -1 : 1;
  });
}

function budgetShare(total: number, count: number, index: number): number {
  const base = Math.floor(total / count);
  return base + (index < total % count ? 1 : 0);
}

function planRationale(motionId: MotionId): string {
  const motion = getMotion(motionId);
  const rubric = motion.rubric
    .map(
      (criterion) =>
        `${criterion.id} (${criterion.weight}): ${criterion.description}`,
    )
    .join("; ");
  return `Selected because connected sources satisfy the declared discovery and evidence requirements. Targets are ordered by descending assessment score using this rubric: ${rubric}. Rejected targets remain visible with their assessment reason.`;
}

function rankedBinding(
  capabilityId: CapabilityId,
  input: BuildPlanInput,
  categories: readonly string[],
):
  | {
      readonly ok: true;
      readonly binding: PlanData["motions"][number]["bindings"][number];
    }
  | { readonly ok: false; readonly reason: string } {
  const excludedAdapterIds =
    input.refusal !== undefined &&
    input.refusal.trigger === "binding_unavailable" &&
    input.refusal.capabilityId === capabilityId &&
    input.refusal.adapterId !== undefined
      ? [input.refusal.adapterId]
      : undefined;
  const ranking = rankAdapters({
    capabilityId,
    adapters: input.adapters,
    weights: input.weights,
    geography: input.spec.geography,
    categories,
    requiredThroughputPerMinute: input.requiredThroughputPerMinute,
    excludedAdapterIds,
  });
  if (!ranking.ok) {
    return ranking;
  }
  const winner = ranking.candidates.find((candidate) => candidate.eligible);
  if (winner === undefined) {
    return {
      ok: false,
      reason: `Ranking for ${capabilityId} did not produce an eligible winner.`,
    };
  }
  const adapter = input.adapters.find(
    (candidate) =>
      candidate.id === winner.adapterId &&
      candidate.mode === winner.mode &&
      candidate.provides.includes(capabilityId),
  );
  if (adapter === undefined) {
    return {
      ok: false,
      reason: `Ranked adapter ${winner.adapterId} disappeared before ${capabilityId} could be bound.`,
    };
  }
  const bound = bindWinner(capabilityId, adapter);
  if (!bound.ok) {
    return bound;
  }
  return {
    ok: true,
    binding: {
      capabilityId,
      weights: input.weights,
      weightsRationale: input.weightsRationale,
      candidates: [...ranking.candidates],
      chosen: {
        adapterId: bound.adapterId,
        mode: bound.mode,
      },
    },
  };
}

function buildPlan(input: BuildPlanInput): OrchestratorResult {
  const selected = input.spec.motions.filter(
    (motionId) => declineReason(motionId) === null,
  );
  if (selected.length === 0) {
    return {
      ok: false,
      reason:
        "Every requested motion was declined because its required data source is not connected.",
    };
  }
  const categories = requestedCategories(input.spec, input.adapters);
  const motions: PlanData["motions"] = [];
  for (const [index, motionId] of selected.entries()) {
    const bindings: PlanData["motions"][number]["bindings"] = [];
    const capabilities = capabilitiesForMotion(motionId);
    for (const capabilityId of capabilities) {
      const result = rankedBinding(capabilityId, input, categories);
      if (!result.ok) {
        return result;
      }
      bindings.push(result.binding);
    }
    motions.push({
      motionId,
      capabilities: [...capabilities],
      operatingBudgetCents: budgetShare(
        input.spec.budget.operating.amountMinor,
        selected.length,
        index,
      ),
      commitBudgetCents: budgetShare(
        input.spec.budget.commit.amountMinor,
        selected.length,
        index,
      ),
      dependsOn: [],
      rationale: planRationale(motionId),
      bindings,
      declined:
        getMotion(motionId).contactModel === "individual"
          ? [
              {
                capabilityId: "people.find",
                reason:
                  "Deferred until a target receives a fit score, avoiding contact-enrichment spend on rejected targets.",
              },
            ]
          : [],
    });
  }

  const parsed = PlanDataSchema.safeParse({
    campaignId: input.campaignId,
    motions,
    policies: [
      {
        kind: "operating_budget_cap",
        description: "Every capability cost is checked before execution.",
      },
      {
        kind: "require_approval",
        description:
          "Outbound messages and creator rosters require human approval.",
      },
      {
        kind: "consent_policy",
        description:
          "Each motion must satisfy its declared consent basis before outreach.",
      },
    ],
    budget: input.spec.budget,
    declinedMotions: input.spec.motions.flatMap((motionId) => {
      const reason = declineReason(motionId);
      return reason === null ? [] : [{ motionId, reason }];
    }),
    replanOf: input.replanOf,
  });
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Plans selected motions and persists every candidate in each returned binding. */
export async function planCampaign(
  input: unknown,
  options: PlanCampaignOptions = {},
): Promise<OrchestratorResult> {
  const parsed = PlanInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  const weights = await deriveRankingWeights(
    parsed.data.spec,
    options.weightsAgent,
  );
  if (!weights.ok) {
    return weights;
  }
  return buildPlan({
    campaignId: parsed.data.campaignId,
    spec: parsed.data.spec,
    adapters:
      options.adapters === undefined
        ? defaultRankingAdapters
        : options.adapters,
    weights: weights.weights,
    weightsRationale: weights.weightsRationale,
    requiredThroughputPerMinute:
      options.requiredThroughputPerMinute === undefined
        ? 1
        : options.requiredThroughputPerMinute,
    replanOf: null,
  });
}

function budgetConstrainedWeights(weights: RankingWeights): RankingWeights {
  const remainder = weights.freshness + weights.confidence + weights.coverage;
  const proposal =
    remainder === 0
      ? { cost: 0.85, freshness: 0.05, confidence: 0.05, coverage: 0.05 }
      : {
          cost: 0.85,
          freshness: (weights.freshness / remainder) * 0.15,
          confidence: (weights.confidence / remainder) * 0.15,
          coverage: (weights.coverage / remainder) * 0.15,
        };
  return RankingWeightsSchema.parse(proposal);
}

function originalWeights(plan: PlanData): RankingWeights | null {
  for (const motion of plan.motions) {
    const binding = motion.bindings[0];
    if (binding !== undefined) {
      return binding.weights;
    }
  }
  return null;
}

/** Re-ranks a refused plan once, with a hard maximum of two re-plans per run. */
export async function replanCampaign(
  input: ReplanCampaignInput,
  options: ReplanCampaignOptions = {},
): Promise<OrchestratorResult> {
  if (!Number.isInteger(input.replanCount) || input.replanCount < 0) {
    return {
      ok: false,
      reason: "Re-plan count must be a nonnegative integer.",
    };
  }
  if (input.replanCount >= MAX_REPLANS) {
    return {
      ok: false,
      reason: `Re-plan limit reached: at most ${MAX_REPLANS} re-plans are allowed per run.`,
    };
  }
  if (input.refusal.reason.trim().length === 0) {
    return { ok: false, reason: "A re-plan refusal must state its reason." };
  }
  if (
    input.refusal.trigger === "binding_unavailable" &&
    (input.refusal.capabilityId === undefined ||
      input.refusal.adapterId === undefined)
  ) {
    return {
      ok: false,
      reason:
        "A binding refusal must identify the unavailable capability and adapter.",
    };
  }
  const previous = PlanDataSchema.safeParse(input.previousPlan);
  if (!previous.success) {
    return {
      ok: false,
      reason: previous.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  const weights = originalWeights(previous.data);
  if (weights === null) {
    return {
      ok: false,
      reason: "The replaced plan has no ranked binding from which to re-plan.",
    };
  }
  const constrainedWeights =
    input.refusal.trigger === "operating_budget_denied"
      ? budgetConstrainedWeights(weights)
      : weights;
  return buildPlan({
    campaignId: previous.data.campaignId,
    spec: input.spec,
    adapters:
      options.adapters === undefined
        ? defaultRankingAdapters
        : options.adapters,
    weights: constrainedWeights,
    weightsRationale:
      input.refusal.trigger === "operating_budget_denied"
        ? `Re-plan constraint: operating budget was denied, so cost now carries 85% of the ranking.`
        : `Re-plan constraint: ${input.refusal.adapterId} is unavailable and cannot remain eligible.`,
    requiredThroughputPerMinute:
      options.requiredThroughputPerMinute === undefined
        ? 1
        : options.requiredThroughputPerMinute,
    replanOf: {
      planId: input.replacedPlanId,
      trigger: input.refusal.trigger,
      reason: input.refusal.reason,
    },
    refusal: input.refusal,
  });
}
