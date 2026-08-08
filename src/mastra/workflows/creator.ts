import { capabilityRegistry } from "../../capabilities";
import type { Adapter } from "../../capabilities/adapter";
import { AssessDataSchema, type Target } from "../../contracts";
import type { NewSignal } from "../../db/repositories";
import { assessmentRubric, getMotion } from "../../motions";
import type { OrganizationInput, OrganizationRuntime } from "./organization";
import { executePlannedCapability } from "./replan";

const CREATOR_PROFILE_METHOD = "Creator profile persisted at discovery";
const CREATOR_PROFILE_WINDOW = "profile snapshot returned by db.query";
const CREATOR_CRITERIA_NOISE = new Set([
  "audience",
  "booking",
  "business",
  "businesses",
  "campaign",
  "company",
  "companies",
  "content",
  "creator",
  "creators",
  "customer",
  "customers",
  "experience",
  "find",
  "flow",
  "gap",
  "gaps",
  "influencer",
  "influencers",
  "local",
  "nearby",
  "online",
  "reliable",
  "target",
  "targets",
]);

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown creator failure.";
}

function terms(value: string): string[] {
  return (value.toLocaleLowerCase("en-IN").match(/[a-z0-9]+/g) ?? []).filter(
    (term) => !CREATOR_CRITERIA_NOISE.has(term),
  );
}

/** Keeps compiled content criteria available to profile-based qualification. */
function campaignContentTerms(
  criteria: readonly string[],
  geography: string,
): ReadonlySet<string> {
  const geographyTerms = new Set(terms(geography));
  return new Set(
    criteria.flatMap(terms).filter((term) => !geographyTerms.has(term)),
  );
}

function matchingProfileLabels(
  labels: readonly string[],
  campaignTerms: ReadonlySet<string>,
): string[] {
  return labels.filter((label) =>
    terms(label).some((term) => campaignTerms.has(term)),
  );
}

function matchingAudienceShare(
  distribution: Readonly<Record<string, number>>,
  campaignTerms: ReadonlySet<string>,
): number {
  return Object.entries(distribution).reduce(
    (share, [label, value]) =>
      terms(label).some((term) => campaignTerms.has(term))
        ? share + value
        : share,
    0,
  );
}

function geographyShare(
  distribution: Readonly<Record<string, number>>,
  geography: string,
): number {
  const normalizedGeography = geography.toLocaleLowerCase("en-IN").trim();
  const entry = Object.entries(distribution).find(
    ([location]) =>
      location.toLocaleLowerCase("en-IN").trim() === normalizedGeography,
  );
  return entry === undefined ? 0 : entry[1];
}

function creatorCommitBudget(input: OrganizationInput): number {
  const creatorMotion = input.plan.motions.find(
    (motion) => motion.motionId === "creator",
  );
  return creatorMotion === undefined
    ? input.plan.budget.commit.amountMinor
    : creatorMotion.commitBudgetCents;
}

/** Builds assessment inputs only from the creator profile saved during discovery. */
function creatorProfileSignal(
  input: OrganizationInput,
  targetId: string,
  metric: string,
  value: number,
  baseline: number,
  implication: string,
): NewSignal {
  return {
    campaignId: input.campaignId,
    runId: input.runId,
    targetId,
    evidenceKind: "statistical",
    payload: {
      metric,
      value,
      baseline,
      method: CREATOR_PROFILE_METHOD,
      window: CREATOR_PROFILE_WINDOW,
      implication,
      strength: 0.95,
    },
  };
}

/**
 * Converts the persisted discovery snapshot into the evidence needed by the
 * creator rubric. Missing profile fields stay absent rather than becoming fit
 * evidence.
 */
function creatorAssessmentSignals(
  input: OrganizationInput,
  target: Extract<Target, { readonly kind: "person" }>,
): NewSignal[] {
  const budget = creatorCommitBudget(input);
  const signals: NewSignal[] = [
    creatorProfileSignal(
      input,
      target.id,
      "follower_count",
      target.payload.followerCount,
      10_000,
      `The persisted profile reports ${target.payload.followerCount.toLocaleString("en-IN")} followers, which is the available reach for ${input.spec.successMetric}.`,
    ),
  ];
  const rate = target.payload.rateCardCommitCents;
  if (rate === null) {
    signals.push(
      creatorProfileSignal(
        input,
        target.id,
        "rate_card_available",
        0,
        1,
        "The persisted profile does not include a reel rate card, so commercial fit cannot be established.",
      ),
    );
  } else {
    signals.push(
      creatorProfileSignal(
        input,
        target.id,
        "rate_card_commit_paise",
        rate,
        budget,
        `The persisted profile lists a reel rate of ${rate.toLocaleString("en-IN")} paise against the creator motion's ${budget.toLocaleString("en-IN")} paise commitment budget.`,
      ),
    );
  }

  const profile = target.payload.profile;
  if (profile === undefined) {
    return signals;
  }

  const localAudienceShare = geographyShare(
    profile.audienceGeography,
    input.spec.geography,
  );
  signals.push(
    creatorProfileSignal(
      input,
      target.id,
      "audience_geography_share",
      localAudienceShare,
      0.4,
      `${Math.round(localAudienceShare * 100)}% of the persisted audience profile is in ${input.spec.geography}.`,
    ),
  );
  const criteriaTerms = campaignContentTerms(
    input.spec.targetCriteria,
    input.spec.geography,
  );
  if (criteriaTerms.size > 0) {
    const matchingCategories = matchingProfileLabels(
      profile.contentCategories,
      criteriaTerms,
    );
    const matchingInterestShare = matchingAudienceShare(
      profile.audienceInterests,
      criteriaTerms,
    );
    const categories = matchingCategories.join(", ");
    signals.push(
      creatorProfileSignal(
        input,
        target.id,
        "content_category_match",
        matchingCategories.length > 0 ? 1 : 0,
        1,
        matchingCategories.length > 0
          ? `The persisted content categories match campaign criteria through ${categories}.`
          : "The persisted content categories do not match the campaign criteria.",
      ),
      creatorProfileSignal(
        input,
        target.id,
        "audience_interest_share",
        matchingInterestShare,
        0.2,
        `${Math.round(matchingInterestShare * 100)}% of the persisted audience interests match the campaign criteria.`,
      ),
    );
  }
  signals.push(
    creatorProfileSignal(
      input,
      target.id,
      "engagement_rate",
      profile.engagementRate,
      0.02,
      `${Math.round(profile.engagementRate * 10_000) / 100}% engagement is reported by the persisted profile.`,
    ),
    creatorProfileSignal(
      input,
      target.id,
      "estimated_reel_reach",
      Math.round(target.payload.followerCount * profile.viewToFollowerRatio),
      10_000,
      "Estimated reel reach is calculated from the persisted follower count and view-to-follower ratio.",
    ),
    creatorProfileSignal(
      input,
      target.id,
      "estimated_authentic_audience_share",
      1 - profile.fakeFollowerEstimate,
      0.8,
      "Estimated authentic audience share is derived from the persisted fake-follower estimate.",
    ),
  );
  return signals;
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
    const signals = await runtime.store.saveSignals(
      creatorAssessmentSignals(input, target),
    );
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
  // Creator-provider categories are not a shared taxonomy, so qualification
  // applies campaign content criteria to the persisted profile after discovery.
  const discovered = await executePlannedCapability({
    capabilityId: "db.query",
    capability: capabilityRegistry["db.query"],
    input: {
      entityKind: "creator",
      filters: {
        locality: input.spec.geography,
      },
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
        results.push(
          await assessCreator(
            { ...input, plan: discovered.plan },
            target,
            runtime,
          ),
        );
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
