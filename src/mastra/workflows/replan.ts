import type { z } from "zod";
import type { Adapter } from "../../capabilities/adapter";
import { type BindingResult, resolveBinding } from "../../capabilities/binding";
import {
  executeCapability,
  type ToolCallContext,
  type ToolCallWriter,
} from "../../capabilities/execute";
import type {
  CapabilityDefinition,
  CapabilityInput,
  CapabilityOutput,
} from "../../capabilities/registry";
import type { CapabilityId } from "../../contracts/capabilities";
import type { CampaignSpecSchema, PlanDataSchema } from "../../contracts/steps";
import { type RankingAdapter, replanCampaign } from "../../orchestrator";

export type PlanData = z.output<typeof PlanDataSchema>;
type CampaignSpec = z.output<typeof CampaignSpecSchema>;
export type ReplanTrigger = "binding_unavailable" | "operating_budget_cap";

export interface WorkflowEvent {
  readonly type: "replan_started" | "replan_completed" | "replan_exhausted";
  readonly campaignId: string;
  readonly runId: string;
  readonly trigger: ReplanTrigger;
  readonly reason: string;
  readonly attempt: number;
}

export interface WorkflowEventSink {
  emit(event: WorkflowEvent): Promise<void>;
}

export interface ReplanRequest {
  readonly plan: PlanData;
  readonly trigger: ReplanTrigger;
  readonly refusal: string;
  readonly attempt: number;
  readonly completedTargetIds: readonly string[];
  readonly capabilityId?: CapabilityId;
  readonly adapterId?: string;
}

export interface Replanner {
  replan(request: ReplanRequest): Promise<PlanData>;
}

/** Adapts the workflow refusal contract to T5's deterministic re-plan entry point. */
export function createOrchestratorReplanner(options: {
  readonly replacedPlanId: string;
  readonly spec: CampaignSpec;
  readonly adapters?: readonly RankingAdapter[];
}): Replanner {
  return {
    async replan(request) {
      const result = await replanCampaign(
        {
          replacedPlanId: options.replacedPlanId,
          previousPlan: request.plan,
          spec: options.spec,
          refusal: {
            trigger:
              request.trigger === "operating_budget_cap"
                ? "operating_budget_denied"
                : "binding_unavailable",
            reason: request.refusal,
            capabilityId: request.capabilityId,
            adapterId: request.adapterId,
          },
          replanCount: request.attempt - 1,
        },
        { adapters: options.adapters },
      );
      if (!result.ok) {
        throw new Error(result.reason);
      }
      return result.data;
    },
  };
}

export type ReplanResult =
  | { readonly ok: true; readonly plan: PlanData }
  | { readonly ok: false; readonly reason: string };

/** Owns the campaign-wide two-attempt re-plan budget. */
export class ReplanController {
  readonly #campaignId: string;
  readonly #runId: string;
  readonly #replanner: Replanner;
  readonly #events: WorkflowEventSink;
  readonly #completedTargetIds = new Set<string>();
  #attempts = 0;
  #currentPlan: PlanData | null = null;
  #inFlight: Promise<ReplanResult> | null = null;

  constructor(options: {
    readonly campaignId: string;
    readonly runId: string;
    readonly replanner: Replanner;
    readonly events: WorkflowEventSink;
  }) {
    this.#campaignId = options.campaignId;
    this.#runId = options.runId;
    this.#replanner = options.replanner;
    this.#events = options.events;
  }

  get attempts(): number {
    return this.#attempts;
  }

  completeTarget(targetId: string): void {
    this.#completedTargetIds.add(targetId);
  }

  latest(fallback: PlanData): PlanData {
    return this.#currentPlan ?? fallback;
  }

  async request(
    plan: PlanData,
    trigger: ReplanTrigger,
    reason: string,
    binding?: {
      readonly capabilityId: CapabilityId;
      readonly adapterId: string;
    },
  ): Promise<ReplanResult> {
    if (this.#inFlight !== null) {
      return this.#inFlight;
    }
    const operation = this.performRequest(plan, trigger, reason, binding);
    this.#inFlight = operation;
    const result = await operation;
    this.#inFlight = null;
    return result;
  }

  private async performRequest(
    plan: PlanData,
    trigger: ReplanTrigger,
    reason: string,
    binding?: {
      readonly capabilityId: CapabilityId;
      readonly adapterId: string;
    },
  ): Promise<ReplanResult> {
    if (this.#attempts >= 2) {
      const exhaustedReason = `Re-plan limit reached after two attempts: ${reason}`;
      await this.#events.emit({
        type: "replan_exhausted",
        campaignId: this.#campaignId,
        runId: this.#runId,
        trigger,
        reason: exhaustedReason,
        attempt: this.#attempts + 1,
      });
      return { ok: false, reason: exhaustedReason };
    }

    this.#attempts += 1;
    await this.#events.emit({
      type: "replan_started",
      campaignId: this.#campaignId,
      runId: this.#runId,
      trigger,
      reason,
      attempt: this.#attempts,
    });
    const nextPlan = await this.#replanner.replan({
      plan: this.latest(plan),
      trigger,
      refusal: reason,
      attempt: this.#attempts,
      completedTargetIds: [...this.#completedTargetIds],
      capabilityId: binding?.capabilityId,
      adapterId: binding?.adapterId,
    });
    await this.#events.emit({
      type: "replan_completed",
      campaignId: this.#campaignId,
      runId: this.#runId,
      trigger,
      reason,
      attempt: this.#attempts,
    });
    this.#currentPlan = nextPlan;
    return { ok: true, plan: nextPlan };
  }
}

function bindingFor<C extends CapabilityId>(plan: PlanData, capabilityId: C) {
  for (const motion of plan.motions) {
    const binding = motion.bindings.find(
      (candidate) => candidate.capabilityId === capabilityId,
    );
    if (binding !== undefined) {
      return {
        capabilityId,
        adapterId: binding.chosen.adapterId,
        mode: binding.chosen.mode,
      };
    }
  }
  return undefined;
}

/** Resolves and executes a persisted binding, re-planning only on resolution failure. */
export async function executePlannedCapability<
  C extends CapabilityId,
>(options: {
  readonly capabilityId: C;
  readonly capability: CapabilityDefinition<C>;
  readonly input: CapabilityInput<C>;
  readonly plan: PlanData;
  readonly adapters: readonly Adapter<C>[];
  readonly context: ToolCallContext;
  readonly ledger: ToolCallWriter;
  readonly replans: ReplanController;
}): Promise<
  | {
      readonly ok: true;
      readonly data: CapabilityOutput<C>;
      readonly plan: PlanData;
    }
  | { readonly ok: false; readonly reason: string }
> {
  const activePlan = options.replans.latest(options.plan);
  const binding = bindingFor(activePlan, options.capabilityId);
  let resolved: BindingResult<C>;
  if (binding === undefined) {
    resolved = {
      ok: false,
      reason: `The plan has no binding for ${options.capabilityId}.`,
    };
  } else {
    resolved = resolveBinding(binding, options.adapters);
  }

  if (!resolved.ok) {
    const replanned = await options.replans.request(
      activePlan,
      "binding_unavailable",
      resolved.reason,
      binding === undefined
        ? undefined
        : {
            capabilityId: binding.capabilityId,
            adapterId: binding.adapterId,
          },
    );
    if (!replanned.ok) {
      return replanned;
    }
    return executePlannedCapability({ ...options, plan: replanned.plan });
  }

  const data = await executeCapability({
    context: options.context,
    capability: options.capability,
    binding: resolved.binding,
    adapter: resolved.adapter,
    input: options.input,
    ledger: options.ledger,
  });
  return { ok: true, data, plan: activePlan };
}
