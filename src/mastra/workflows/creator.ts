import type { z } from "zod";
import { capabilityRegistry } from "../../capabilities";
import type { Adapter } from "../../capabilities/adapter";
import type { TargetCandidateSchema } from "../../contracts/capabilities";
import type { CreatorShortlistDataSchema } from "../../contracts/steps";
import { assessmentRubric, getMotion } from "../../motions";
import { allocateCreators } from "../../synthesis";
import { runCreatorSelector } from "../agents/creator-selector";
import type { StructuredAgent } from "../agents/runner";
import type { OrganizationInput, OrganizationRuntime } from "./organization";
import { executePlannedCapability } from "./replan";

type TargetCandidate = z.output<typeof TargetCandidateSchema>;
type CreatorCandidate = Extract<TargetCandidate, { readonly kind: "person" }>;
type CreatorDecision = z.output<
  typeof CreatorShortlistDataSchema
>["decisions"][number];

function creatorCandidates(candidates: readonly TargetCandidate[]) {
  return candidates.flatMap((candidate) =>
    candidate.kind === "person"
      ? [
          {
            externalRef: candidate.externalRef,
            name: candidate.name,
            payload: candidate.payload,
          },
        ]
      : [],
  );
}

function withSelection(
  candidate: Omit<CreatorCandidate, "kind">,
  decision: CreatorDecision,
) {
  const isFit =
    decision.isFit && candidate.payload.rateCardCommitCents !== null;
  return {
    ...candidate,
    payload: {
      ...candidate.payload,
      selection: {
        isFit,
        relevanceScore: decision.relevanceScore,
        reason:
          decision.isFit && !isFit
            ? `${decision.reason} Rejected because no usable rate card was supplied.`
            : decision.reason,
      },
    },
  };
}

/** Qualifies every discovered creator and rejects incomplete selector output. */
export async function shortlistCreators(
  input: OrganizationInput,
  candidates: readonly TargetCandidate[],
  selector: StructuredAgent<z.output<typeof CreatorShortlistDataSchema>>,
) {
  const people = creatorCandidates(candidates);
  if (people.length === 0) {
    return {
      ok: false as const,
      reason: "Creator discovery returned no people.",
    };
  }

  const result = await runCreatorSelector(
    { spec: input.spec, candidates: people },
    selector,
  );
  if (!result.ok) {
    return result;
  }
  const available = new Map(
    people.map((candidate) => [candidate.externalRef, candidate]),
  );
  const seen = new Set<string>();
  const qualified = [];

  for (const decision of result.data.decisions) {
    const candidate = available.get(decision.externalRef);
    if (candidate === undefined) {
      return {
        ok: false as const,
        reason: `Creator selector returned an unknown candidate: ${decision.externalRef}.`,
      };
    }
    if (seen.has(decision.externalRef)) {
      return {
        ok: false as const,
        reason: `Creator selector returned ${decision.externalRef} more than once.`,
      };
    }
    seen.add(decision.externalRef);
    qualified.push(withSelection(candidate, decision));
  }

  const missing = people.find((candidate) => !seen.has(candidate.externalRef));
  if (missing !== undefined) {
    return {
      ok: false as const,
      reason: `Creator selector omitted candidate ${missing.externalRef}.`,
    };
  }

  return { ok: true as const, candidates: qualified };
}

/** Discovers, qualifies, persists, and allocates the complete creator pool. */
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
      filters: { locality: input.spec.geography },
      limit: 100,
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

  const shortlisted = await shortlistCreators(
    { ...input, plan: discovered.plan },
    discovered.data.targets,
    runtime.agents.selectCreators,
  );
  if (!shortlisted.ok) {
    return { ok: false, targetIds: [], failures: [shortlisted.reason] };
  }

  const targets = await runtime.store.saveTargets(
    shortlisted.candidates.map((candidate) => ({
      ...candidate,
      campaignId: input.campaignId,
      motionId: "creator",
      kind: "person",
      relationship: "prospect_partner",
    })),
  );
  const rubric = assessmentRubric(getMotion("creator"));
  await Promise.all(
    targets.map(async (target) => {
      if (target.kind !== "person" || target.payload.selection == null) {
        throw new Error(`Creator target ${target.id} has no qualification decision.`);
      }
      const decision = target.payload.selection;
      const isFit = decision.isFit === true;
      await runtime.store.saveAssessment({
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: target.id,
        score: decision.relevanceScore,
        isFit,
        reason: decision.reason,
        droppedCount: 0,
        rubric,
      });
      await runtime.store.updateTarget(
        target.id,
        isFit ? "fit" : "not_fit",
      );
      await runtime.events.emit({
        type: "assessment.recorded",
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: target.id,
        score: decision.relevanceScore,
        isFit,
        reason: decision.reason,
        droppedCount: 0,
      });
    }),
  );

  const creatorMotion = input.plan.motions.find(
    (motion) => motion.motionId === "creator",
  );
  if (creatorMotion === undefined) {
    return {
      ok: false,
      targetIds: targets.map((target) => target.id),
      failures: ["Creator allocation has no planned motion budget."],
    };
  }
  const allocation = allocateCreators({
    creators: targets.flatMap((target) =>
      target.kind === "person" &&
      target.payload.selection?.isFit === true &&
      target.payload.rateCardCommitCents !== null
        ? [
            {
              targetId: target.id,
              name: target.name,
              fitScore: target.payload.selection.relevanceScore,
              ratePaise: target.payload.rateCardCommitCents,
            },
          ]
        : [],
    ),
    audienceOverlaps: [],
    commitBudgetPaise: creatorMotion.commitBudgetCents,
    maxPerDealPaise: creatorMotion.commitBudgetCents,
  });
  await Promise.all(
    allocation.decisions.map((decision) =>
      runtime.store.saveAllocation({
        campaignId: input.campaignId,
        targetId: decision.targetId,
        motionId: "creator",
        commitCents: decision.pricePaise,
        selected: decision.selected,
        reason: `${decision.reason} Effective fit ${decision.effectiveFitScore.toFixed(2)}; overlap penalty ${Math.round(decision.overlapPenalty * 100)}%.`,
      }),
    ),
  );

  targets.forEach((target) => {
    runtime.replans.completeTarget(target.id);
  });

  return {
    ok: true,
    targetIds: targets.map((target) => target.id),
    failures: [],
  };
}
