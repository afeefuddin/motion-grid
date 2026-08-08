import { AdapterCandidateSchema } from "../contracts/steps";
import type { RankingAdapter, RankingRequest, RankingResult } from "./types";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-IN");
}

function listCovers(values: readonly string[], requested: string): boolean {
  const wanted = normalized(requested);
  return values.some((value) => {
    const available = normalized(value);
    return (
      available === "*" ||
      available === wanted ||
      wanted.includes(available) ||
      available.includes(wanted)
    );
  });
}

function coverageScore(
  adapter: RankingAdapter,
  geography: string,
  categories: readonly string[],
): number {
  const geographyCovered = listCovers(
    adapter.profile.coverage.geographies,
    geography,
  );
  const categoryCovered =
    categories.length === 0 ||
    categories.every((category) =>
      listCovers(adapter.profile.coverage.categories, category),
    );
  return geographyCovered && categoryCovered ? 1 : 0;
}

function lowerIsBetter(value: number, minimum: number): number {
  if (value === minimum) {
    return 1;
  }
  return (minimum + 1) / (value + 1);
}

function stableScore(value: number): number {
  return Number(value.toFixed(9));
}

function compareIds(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function exclusionReason(
  adapter: RankingAdapter,
  request: RankingRequest,
): string | null {
  if (request.excludedAdapterIds !== undefined) {
    if (request.excludedAdapterIds.includes(adapter.id)) {
      return "Excluded by the refusal that triggered this re-plan.";
    }
  }
  if (
    adapter.profile.rateLimitPerMinute !== null &&
    adapter.profile.rateLimitPerMinute < request.requiredThroughputPerMinute
  ) {
    return `Rate limit ${adapter.profile.rateLimitPerMinute}/min is below the required ${request.requiredThroughputPerMinute}/min throughput.`;
  }
  return null;
}

/**
 * Ranks every adapter providing a capability without I/O or hidden state.
 *
 * Ineligible candidates remain in the returned array so the decision is auditable.
 */
export function rankAdapters(request: RankingRequest): RankingResult {
  const adapters = request.adapters.filter((adapter) =>
    adapter.provides.includes(request.capabilityId),
  );
  if (adapters.length === 0) {
    return {
      ok: false,
      reason: `No adapter declares capability ${request.capabilityId}.`,
    };
  }

  const minimumCost = Math.min(
    ...adapters.map((adapter) => adapter.unitCost.operatingCents),
  );
  const minimumFreshness = Math.min(
    ...adapters.map((adapter) => adapter.profile.freshnessDays),
  );
  const scored = adapters.map((adapter) => {
    const coverage = coverageScore(
      adapter,
      request.geography,
      request.categories,
    );
    const excluded = exclusionReason(adapter, request);
    const eligible = coverage === 1 && excluded === null;
    const dimensionScores = {
      cost: stableScore(
        lowerIsBetter(adapter.unitCost.operatingCents, minimumCost),
      ),
      freshness: stableScore(
        lowerIsBetter(adapter.profile.freshnessDays, minimumFreshness),
      ),
      confidence: adapter.profile.expectedConfidence,
      coverage,
    };
    const totalScore = stableScore(
      dimensionScores.cost * request.weights.cost +
        dimensionScores.freshness * request.weights.freshness +
        dimensionScores.confidence * request.weights.confidence +
        dimensionScores.coverage * request.weights.coverage,
    );
    const unavailableReason =
      coverage === 0
        ? `Coverage does not include ${request.geography} and the requested target categories.`
        : excluded;
    return {
      adapterId: adapter.id,
      mode: adapter.mode,
      dimensionScores,
      totalScore,
      eligible,
      reason:
        unavailableReason === null
          ? "Eligible candidate; final rank is determined by the weighted score."
          : unavailableReason,
    };
  });

  scored.sort(
    (left, right) =>
      right.totalScore - left.totalScore ||
      compareIds(left.adapterId, right.adapterId),
  );
  const winner = scored.find((candidate) => candidate.eligible);
  if (winner === undefined) {
    return {
      ok: false,
      reason: `No eligible adapter remains for ${request.capabilityId}; all candidates are retained in the attempted ranking.`,
    };
  }

  const candidates = scored.map((candidate) =>
    AdapterCandidateSchema.parse({
      ...candidate,
      reason:
        candidate.adapterId === winner.adapterId
          ? `Chosen: highest eligible score (${candidate.totalScore.toFixed(9)}).`
          : candidate.eligible
            ? `Not chosen: eligible score ${candidate.totalScore.toFixed(9)} ranked below ${winner.adapterId}.`
            : candidate.reason,
    }),
  );
  return { ok: true, candidates };
}
