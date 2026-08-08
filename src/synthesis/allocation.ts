import { formatInr } from "../sim/format-inr";

export interface ScoredCreator {
  readonly targetId: string;
  readonly name: string;
  readonly fitScore: number;
  readonly ratePaise: number;
}

export interface AudienceOverlap {
  readonly firstTargetId: string;
  readonly secondTargetId: string;
  readonly confidence: number;
}

export interface CreatorAllocationInput {
  readonly creators: readonly ScoredCreator[];
  readonly audienceOverlaps: readonly AudienceOverlap[];
  readonly commitBudgetPaise: number;
  readonly maxPerDealPaise: number;
}

export interface CreatorAllocationDecision {
  readonly targetId: string;
  readonly name: string;
  readonly selected: boolean;
  readonly pricePaise: number;
  readonly fitScore: number;
  readonly effectiveFitScore: number;
  readonly overlapPenalty: number;
  readonly reason: string;
}

export interface CreatorAllocationResult {
  readonly decisions: readonly CreatorAllocationDecision[];
  readonly chosenTargetIds: readonly string[];
  readonly totalCommitPaise: number;
  readonly overlapPenaltyApplied: number;
  readonly rationale: string;
}

function overlapWithChosen(
  targetId: string,
  chosen: ReadonlySet<string>,
  overlaps: readonly AudienceOverlap[],
): number {
  return overlaps.reduce((penalty, overlap) => {
    const otherTargetId =
      overlap.firstTargetId === targetId
        ? overlap.secondTargetId
        : overlap.secondTargetId === targetId
          ? overlap.firstTargetId
          : null;
    return otherTargetId !== null && chosen.has(otherTargetId)
      ? Math.max(penalty, overlap.confidence)
      : penalty;
  }, 0);
}

function validateInput(input: CreatorAllocationInput): void {
  if (
    !Number.isInteger(input.commitBudgetPaise) ||
    input.commitBudgetPaise < 0
  ) {
    throw new Error("commitBudgetPaise must be a nonnegative integer.");
  }
  if (!Number.isInteger(input.maxPerDealPaise) || input.maxPerDealPaise < 0) {
    throw new Error("maxPerDealPaise must be a nonnegative integer.");
  }
  for (const creator of input.creators) {
    if (
      !Number.isInteger(creator.ratePaise) ||
      creator.ratePaise < 0 ||
      creator.fitScore < 0 ||
      creator.fitScore > 1
    ) {
      throw new Error(
        `Creator ${creator.targetId} has an invalid score or rate.`,
      );
    }
  }
  for (const overlap of input.audienceOverlaps) {
    if (overlap.confidence < 0 || overlap.confidence > 1) {
      throw new Error(
        "Audience overlap confidence must be between zero and one.",
      );
    }
  }
}

/**
 * Greedily allocates an INR commitment budget using marginal fit per paise.
 *
 * Candidates remain visible when excluded by the per-deal cap or remaining budget.
 */
export function allocateCreators(
  input: CreatorAllocationInput,
): CreatorAllocationResult {
  validateInput(input);
  const decisions = new Map<string, CreatorAllocationDecision>();
  const eligible = input.creators.filter((creator) => {
    if (creator.ratePaise <= input.maxPerDealPaise) {
      return true;
    }
    decisions.set(creator.targetId, {
      ...creator,
      selected: false,
      pricePaise: creator.ratePaise,
      effectiveFitScore: creator.fitScore,
      overlapPenalty: 0,
      reason: `Excluded: ${formatInr(creator.ratePaise)} exceeds ${formatInr(input.maxPerDealPaise)} per-deal cap.`,
    });
    return false;
  });
  const remaining = new Map(
    eligible.map((creator) => [creator.targetId, creator]),
  );
  const chosen = new Set<string>();
  let totalCommitPaise = 0;

  while (remaining.size > 0) {
    const ranked = [...remaining.values()]
      .map((creator) => {
        const overlapPenalty = overlapWithChosen(
          creator.targetId,
          chosen,
          input.audienceOverlaps,
        );
        const effectiveFitScore = creator.fitScore * (1 - overlapPenalty);
        const valuePerPaise =
          creator.ratePaise === 0
            ? Number.POSITIVE_INFINITY
            : effectiveFitScore / creator.ratePaise;
        return { creator, overlapPenalty, effectiveFitScore, valuePerPaise };
      })
      .sort(
        (left, right) =>
          right.valuePerPaise - left.valuePerPaise ||
          right.effectiveFitScore - left.effectiveFitScore ||
          left.creator.targetId.localeCompare(right.creator.targetId),
      );
    const winner = ranked.find(
      ({ creator }) =>
        totalCommitPaise + creator.ratePaise <= input.commitBudgetPaise,
    );
    if (winner === undefined) {
      break;
    }

    chosen.add(winner.creator.targetId);
    remaining.delete(winner.creator.targetId);
    totalCommitPaise += winner.creator.ratePaise;
    decisions.set(winner.creator.targetId, {
      ...winner.creator,
      selected: true,
      pricePaise: winner.creator.ratePaise,
      effectiveFitScore: Number(winner.effectiveFitScore.toFixed(4)),
      overlapPenalty: winner.overlapPenalty,
      reason:
        winner.overlapPenalty > 0
          ? `Selected after a ${Math.round(winner.overlapPenalty * 100)}% audience-overlap discount.`
          : "Selected for the strongest fit per rupee at this allocation step.",
    });
  }

  for (const creator of remaining.values()) {
    const overlapPenalty = overlapWithChosen(
      creator.targetId,
      chosen,
      input.audienceOverlaps,
    );
    decisions.set(creator.targetId, {
      ...creator,
      selected: false,
      pricePaise: creator.ratePaise,
      effectiveFitScore: Number(
        (creator.fitScore * (1 - overlapPenalty)).toFixed(4),
      ),
      overlapPenalty,
      reason: `Excluded: ${formatInr(creator.ratePaise)} does not fit the ${formatInr(input.commitBudgetPaise - totalCommitPaise)} remaining budget.`,
    });
  }

  const orderedDecisions = input.creators.map((creator) => {
    const decision = decisions.get(creator.targetId);
    if (decision === undefined) {
      throw new Error(
        `Creator ${creator.targetId} has no allocation decision.`,
      );
    }
    return decision;
  });
  const overlapPenaltyApplied = orderedDecisions
    .filter((decision) => decision.selected)
    .reduce((total, decision) => total + decision.overlapPenalty, 0);

  return {
    decisions: orderedDecisions,
    chosenTargetIds: orderedDecisions
      .filter((decision) => decision.selected)
      .map((decision) => decision.targetId),
    totalCommitPaise,
    overlapPenaltyApplied: Number(overlapPenaltyApplied.toFixed(4)),
    rationale: `Selected ${chosen.size} creator${chosen.size === 1 ? "" : "s"} for ${formatInr(totalCommitPaise)} within a ${formatInr(input.commitBudgetPaise)} commitment budget; marginal fit was discounted for shared audiences.`,
  };
}
