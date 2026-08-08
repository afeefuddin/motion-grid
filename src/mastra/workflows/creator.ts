import { capabilityRegistry } from "../../capabilities";
import type { Adapter } from "../../capabilities/adapter";
import { AssessDataSchema, type Target } from "../../contracts";
import { assessmentRubric, getMotion } from "../../motions";
import type { OrganizationInput, OrganizationRuntime } from "./organization";
import { executePlannedCapability } from "./replan";

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown creator failure.";
}

async function assessCreator(
  input: OrganizationInput,
  target: Target,
  runtime: OrganizationRuntime,
): Promise<
  | { readonly ok: true; readonly targetId: string }
  | { readonly ok: false; readonly targetId: string; readonly reason: string }
> {
  try {
    if (target.kind !== "person") {
      return {
        ok: false,
        targetId: target.id,
        reason: "creator requires a person target.",
      };
    }
    const rate = target.payload.rateCardCommitCents ?? 0;
    const signals = await runtime.store.saveSignals([
      {
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: target.id,
        evidenceKind: "statistical",
        payload: {
          metric: "follower_count",
          value: target.payload.followerCount,
          baseline: 10_000,
          method: "Connected creator profile",
          window: "current profile snapshot",
          implication: "Measures the creator's available reach.",
          strength: 0.95,
        },
      },
      {
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: target.id,
        evidenceKind: "statistical",
        payload: {
          metric: "rate_card_commit_paise",
          value: rate,
          baseline: input.plan.budget.commit.amountMinor,
          method: "Connected creator rate card",
          window: "current rate card",
          implication: "Measures commercial fit against the campaign budget.",
          strength: 0.95,
        },
      },
    ]);
    const assessed = await runtime.agents.assess.generate(
      JSON.stringify({
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: target.id,
        signals,
        rubric: assessmentRubric(getMotion("creator")),
        droppedCount: 0,
      }),
    );
    const assessment = AssessDataSchema.parse(assessed.object);
    await runtime.store.saveAssessment({
      campaignId: input.campaignId,
      runId: input.runId,
      targetId: target.id,
      score: assessment.score,
      isFit: assessment.isFit,
      reason: assessment.reason,
      droppedCount: 0,
      rubric: assessmentRubric(getMotion("creator")),
    });
    await runtime.store.updateTarget(
      target.id,
      assessment.isFit ? "fit" : "not_fit",
    );
    runtime.replans.completeTarget(target.id);
    return { ok: true, targetId: target.id };
  } catch (error) {
    return { ok: false, targetId: target.id, reason: errorReason(error) };
  }
}

/** Discovers creators once and assesses each persisted profile independently. */
export async function runCreatorMotion(
  input: OrganizationInput,
  runtime: OrganizationRuntime,
  adapters: readonly Adapter<"db.query">[],
): Promise<{
  readonly ok: boolean;
  readonly targetIds: readonly string[];
  readonly failures: readonly string[];
}> {
  const discovered = await executePlannedCapability({
    capabilityId: "db.query",
    capability: capabilityRegistry["db.query"],
    input: {
      entityKind: "creator",
      filters: {},
      limit: 60,
    },
    plan: input.plan,
    adapters,
    context: {
      campaignId: input.campaignId,
      runId: input.runId,
      targetId: null,
    },
    ledger: runtime.ledger,
    replans: runtime.replans,
  });
  if (!discovered.ok) {
    return { ok: false, targetIds: [], failures: [discovered.reason] };
  }
  const targets = await runtime.store.saveTargets(
    discovered.data.targets.map((target) => ({
      ...target,
      campaignId: input.campaignId,
      motionId: "creator",
      relationship: "prospect_partner",
    })),
  );
  const results: (
    | { readonly ok: true; readonly targetId: string }
    | { readonly ok: false; readonly targetId: string; readonly reason: string }
  )[] = [];
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < targets.length) {
      const target = targets[cursor];
      cursor += 1;
      if (target !== undefined) {
        results.push(await assessCreator(input, target, runtime));
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(8, targets.length) }, () => worker()),
  );
  const targetIds = results.flatMap((result) =>
    result.ok ? [result.targetId] : [],
  );
  const failures = results.flatMap((result) =>
    result.ok ? [] : [result.reason],
  );
  return { ok: failures.length === 0, targetIds, failures };
}
