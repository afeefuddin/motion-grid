import type { z } from "zod";
import type { SourceDocumentSchema } from "../contracts/steps";
import { normalizeEvidence } from "../evidence";
import { assessmentRubric, getMotion } from "../motions";
import type { Business, Creator } from "../sim/schema";
import { simWorld } from "../sim/world";

type SourceDocument = z.output<typeof SourceDocumentSchema>;

export type EvaluatedMotionId =
  | "business.local"
  | "business.online"
  | "creator";
export type DeclinedMotionId = "consumer.ads" | "consumer.email";

export interface DocumentaryCitation {
  readonly sourceRef: string;
  readonly excerpt: string;
}

export interface EvaluatedCandidate {
  readonly isFit: boolean;
  readonly score: number;
  /** Rubric criterion IDs the evaluator says are supported by the supplied input. */
  readonly criteria: readonly string[];
  /** Verbatim citations are required only for organization observations. */
  readonly citations: readonly DocumentaryCitation[];
}

export interface OrganizationEvaluationInput {
  readonly kind: "organization";
  readonly id: string;
  readonly motionId: "business.local" | "business.online";
  readonly objective: string;
  readonly target: {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly locality: string;
  };
  readonly documents: readonly SourceDocument[];
  readonly rubric: readonly string[];
}

/** The discovery snapshot available to production creator qualification. */
export interface CreatorProfileEvaluationInput {
  readonly platform: Creator["platform"];
  readonly handle: string;
  readonly followerCount: number;
  readonly rateCardCommitCents: number;
  readonly audienceGeography: Creator["audience"]["geography"];
  readonly audienceInterests: Creator["audience"]["interests"];
  readonly contentCategories: Creator["contentCategories"];
  readonly engagementRate: Creator["engagementRate"];
  readonly viewToFollowerRatio: Creator["viewToFollowerRatio"];
  readonly fakeFollowerEstimate: Creator["fakeFollowerEstimate"];
}

export interface CreatorEvaluationInput {
  readonly kind: "creator";
  readonly id: string;
  readonly motionId: "creator";
  readonly objective: string;
  readonly profile: CreatorProfileEvaluationInput;
  readonly rubric: readonly string[];
}

export type EvaluationInput =
  | OrganizationEvaluationInput
  | CreatorEvaluationInput;

interface FitExpectation {
  readonly expectedDecision: "fit" | "not_fit";
  readonly minimumScore?: number;
  readonly maximumScore?: number;
  readonly requiredCriteria: readonly string[];
  readonly allowedCriteria: readonly string[];
  readonly minimumDistinctSources: number;
}

export interface EvaluatedMotionCase {
  readonly kind: "evaluated";
  readonly id: string;
  readonly motionId: EvaluatedMotionId;
  readonly objective: string;
  readonly input: EvaluationInput;
  /**
   * Kept separate from input so a caller cannot accidentally send ground truth
   * to a model evaluator.
   */
  readonly expectation: FitExpectation;
  readonly note: string;
}

export interface ExpectedDeclineCase {
  readonly kind: "expected_decline";
  readonly id: string;
  readonly motionId: DeclinedMotionId;
  readonly objective: string;
  readonly connectedSources: readonly [];
  readonly expectedReason: string;
  readonly note: string;
}

export type SimulatedWorldCase =
  | EvaluatedMotionCase
  | ExpectedDeclineCase;

export interface EvaluationExecutor {
  /**
   * The harness deliberately owns no model client. Callers can inject a
   * fixture evaluator or an explicitly authorized model client at this seam.
   */
  evaluate(input: EvaluationInput): Promise<EvaluatedCandidate>;
}

export interface EvaluatedCaseResult {
  readonly id: string;
  readonly motionId: EvaluatedMotionId;
  readonly expectedDecision: "fit" | "not_fit";
  readonly actual: EvaluatedCandidate;
  readonly citationCount: number;
  readonly groundedCitationCount: number;
  readonly checks: {
    readonly decision: boolean;
    readonly score: boolean;
    readonly criteria: boolean;
    readonly citations: boolean;
    readonly sourceCoverage: boolean;
  };
  readonly passed: boolean;
}

export interface ExpectedDeclineResult {
  readonly id: string;
  readonly motionId: DeclinedMotionId;
  readonly expectedReason: string;
}

export interface EvaluationMetrics {
  readonly evaluatedCases: number;
  readonly passedCases: number;
  readonly decisionAccuracy: number;
  readonly fitPrecision: number | null;
  readonly fitRecall: number | null;
  readonly fitF1: number | null;
  readonly groundedCitationRate: number | null;
  readonly expectedDeclines: number;
}

export interface SimulatedWorldEvaluationReport {
  readonly results: readonly EvaluatedCaseResult[];
  /** Consumer motions are reported, not executed, until first-party fixtures exist. */
  readonly expectedDeclines: readonly ExpectedDeclineResult[];
  readonly metrics: EvaluationMetrics;
}

function business(id: string): Business {
  const found = simWorld.businesses.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`Simulated-world business ${id} is missing.`);
  }
  return found;
}

function creator(id: string): Creator {
  const found = simWorld.creators.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`Simulated-world creator ${id} is missing.`);
  }
  return found;
}

function organizationDocuments(
  candidate: Business,
  observations: readonly string[],
): readonly SourceDocument[] {
  const documents: SourceDocument[] = [];
  if (observations.includes("web.fetch")) {
    documents.push({
      kind: "web",
      document: {
        sourceRef: `sim:web:${candidate.id}`,
        url: candidate.website.url,
        contentType: "text/html; charset=utf-8",
        content: candidate.website.html,
        fetchedAt: candidate.website.capturedAt,
      },
    });
  }
  if (observations.includes("reviews.fetch")) {
    documents.push({
      kind: "reviews",
      sourceRef: `sim:reviews:${candidate.id}`,
      reviews: [...candidate.reviews].sort(
        (left, right) =>
          left.rating - right.rating ||
          left.occurredAt.localeCompare(right.occurredAt),
      ).slice(0, 6),
    });
  }
  return documents;
}

function organizationInput(
  id: string,
  motionId: "business.local" | "business.online",
  objective: string,
): OrganizationEvaluationInput {
  const candidate = business(id);
  const motion = getMotion(motionId);
  return {
    kind: "organization",
    id,
    motionId,
    objective,
    target: {
      id: candidate.id,
      name: candidate.name,
      category: candidate.category,
      locality: candidate.locality,
    },
    // This mirrors the motion declaration, not an adapter implementation.
    documents: organizationDocuments(candidate, motion.observation),
    rubric: assessmentRubric(motion),
  };
}

function creatorInput(id: string, objective: string): CreatorEvaluationInput {
  const candidate = creator(id);
  return {
    kind: "creator",
    id,
    motionId: "creator",
    objective,
    profile: {
      platform: candidate.platform,
      handle: candidate.handle,
      followerCount: candidate.followers,
      rateCardCommitCents: candidate.rateCard.reel.amountPaise,
      audienceGeography: candidate.audience.geography,
      audienceInterests: candidate.audience.interests,
      contentCategories: candidate.contentCategories,
      engagementRate: candidate.engagementRate,
      viewToFollowerRatio: candidate.viewToFollowerRatio,
      fakeFollowerEstimate: candidate.fakeFollowerEstimate,
    },
    rubric: assessmentRubric(getMotion("creator")),
  };
}

function organizationCase(input: {
  readonly id: string;
  readonly motionId: "business.local" | "business.online";
  readonly businessId: string;
  readonly objective: string;
  readonly expectation: FitExpectation;
  readonly note: string;
}): EvaluatedMotionCase {
  return {
    kind: "evaluated",
    id: input.id,
    motionId: input.motionId,
    objective: input.objective,
    input: organizationInput(input.businessId, input.motionId, input.objective),
    expectation: input.expectation,
    note: input.note,
  };
}

function creatorCase(input: {
  readonly id: string;
  readonly creatorId: string;
  readonly objective: string;
  readonly expectation: FitExpectation;
  readonly note: string;
}): EvaluatedMotionCase {
  return {
    kind: "evaluated",
    id: input.id,
    motionId: "creator",
    objective: input.objective,
    input: creatorInput(input.creatorId, input.objective),
    expectation: input.expectation,
    note: input.note,
  };
}

const localObjective =
  "Find Bengaluru local businesses with a concrete booking-flow gap for a website conversion offer.";
const onlineObjective =
  "Find Bengaluru companies with a website conversion gap and customer booking pain for an online growth offer.";
const creatorObjective =
  "Find Bengaluru beauty creators for a salon launch with a reel budget below INR 20,000.";

/**
 * Curated labels for evaluation only. They are never sent through EvaluationInput.
 *
 * The current world has category-quality confounding, so these cases are a smoke
 * matrix, not a statistically valid proof of generalization. The accompanying
 * documentation defines the balanced counterfactual set needed for a release gate.
 */
export const simulatedWorldCases: readonly SimulatedWorldCase[] = [
  organizationCase({
    id: "local-salon-bad-site",
    motionId: "business.local",
    businessId: "business-01",
    objective: localObjective,
    expectation: {
      expectedDecision: "fit",
      minimumScore: 0.65,
      requiredCriteria: ["booking_gap", "stale_site", "mobile_gap"],
      allowedCriteria: [
        "booking_gap",
        "stale_site",
        "mobile_gap",
        "unanswered_calls",
        "rating_trend",
        "instagram_booking",
      ],
      minimumDistinctSources: 2,
    },
    note:
      "Bad-site positive control with both markup defects and review-based booking pain.",
  }),
  organizationCase({
    id: "local-skin-clinic-bad-site",
    motionId: "business.local",
    businessId: "business-12",
    objective: localObjective,
    expectation: {
      expectedDecision: "fit",
      minimumScore: 0.65,
      requiredCriteria: ["booking_gap", "stale_site", "mobile_gap"],
      allowedCriteria: [
        "booking_gap",
        "stale_site",
        "mobile_gap",
        "unanswered_calls",
        "rating_trend",
        "instagram_booking",
      ],
      minimumDistinctSources: 2,
    },
    note: "Bad-site positive control in a different category and locality.",
  }),
  organizationCase({
    id: "local-dental-mid-site",
    motionId: "business.local",
    businessId: "business-26",
    objective: localObjective,
    expectation: {
      expectedDecision: "fit",
      minimumScore: 0.6,
      requiredCriteria: ["booking_gap", "stale_site"],
      allowedCriteria: [
        "booking_gap",
        "stale_site",
        "unanswered_calls",
        "rating_trend",
        "instagram_booking",
      ],
      minimumDistinctSources: 2,
    },
    note: "Boundary positive: mailto booking is not a reliable online booking path.",
  }),
  organizationCase({
    id: "local-gym-mid-site",
    motionId: "business.local",
    businessId: "business-33",
    objective: localObjective,
    expectation: {
      expectedDecision: "fit",
      minimumScore: 0.6,
      requiredCriteria: ["booking_gap", "stale_site"],
      allowedCriteria: [
        "booking_gap",
        "stale_site",
        "unanswered_calls",
        "rating_trend",
        "instagram_booking",
      ],
      minimumDistinctSources: 2,
    },
    note: "Paired-category positive control for the good gym negative below.",
  }),
  organizationCase({
    id: "local-gym-good-site",
    motionId: "business.local",
    businessId: "business-37",
    objective: localObjective,
    expectation: {
      expectedDecision: "not_fit",
      maximumScore: 0.45,
      requiredCriteria: [],
      allowedCriteria: [],
      minimumDistinctSources: 0,
    },
    note:
      "Negative control: operational reviews must not be turned into a nonexistent booking or mobile defect.",
  }),
  organizationCase({
    id: "local-pet-clinic-good-site",
    motionId: "business.local",
    businessId: "business-45",
    objective: localObjective,
    expectation: {
      expectedDecision: "not_fit",
      maximumScore: 0.45,
      requiredCriteria: [],
      allowedCriteria: [],
      minimumDistinctSources: 0,
    },
    note: "Negative control for a responsive site with a live booking widget.",
  }),
  organizationCase({
    id: "local-cafe-good-site",
    motionId: "business.local",
    businessId: "business-54",
    objective: localObjective,
    expectation: {
      expectedDecision: "not_fit",
      maximumScore: 0.45,
      requiredCriteria: [],
      allowedCriteria: [],
      minimumDistinctSources: 0,
    },
    note: "Negative control covering the sixth locality in the simulated world.",
  }),
  organizationCase({
    id: "online-dental-mid-site",
    motionId: "business.online",
    businessId: "business-25",
    objective: onlineObjective,
    expectation: {
      expectedDecision: "fit",
      minimumScore: 0.6,
      requiredCriteria: ["digital_conversion_gap", "buyer_pain"],
      allowedCriteria: ["digital_conversion_gap", "buyer_pain"],
      minimumDistinctSources: 2,
    },
    note:
      "Positive control: the website conversion gap and customer booking pain must each be grounded in the motion's declared observations.",
  }),
  organizationCase({
    id: "online-gym-good-site",
    motionId: "business.online",
    businessId: "business-39",
    objective: onlineObjective,
    expectation: {
      expectedDecision: "not_fit",
      maximumScore: 0.45,
      requiredCriteria: [],
      allowedCriteria: [],
      minimumDistinctSources: 0,
    },
    note:
      "Negative control: a live booking widget and unrelated operational complaints do not establish the requested online conversion problem.",
  }),
  creatorCase({
    id: "creator-beauty-budget-fit",
    creatorId: "creator-07",
    objective: creatorObjective,
    expectation: {
      expectedDecision: "fit",
      minimumScore: 0.65,
      requiredCriteria: ["audience_fit", "commercial_fit"],
      allowedCriteria: ["audience_fit", "commercial_fit", "credible_reach"],
      minimumDistinctSources: 0,
    },
    note: "Beauty-category creator whose reel rate is within the stated budget.",
  }),
  creatorCase({
    id: "creator-non-beauty-control",
    creatorId: "creator-03",
    objective: creatorObjective,
    expectation: {
      expectedDecision: "not_fit",
      maximumScore: 0.45,
      requiredCriteria: [],
      allowedCriteria: [],
      minimumDistinctSources: 0,
    },
    note: "Negative control: an affordable rate does not compensate for missing beauty relevance.",
  }),
  creatorCase({
    id: "creator-over-budget-control",
    creatorId: "creator-21",
    objective: creatorObjective,
    expectation: {
      expectedDecision: "not_fit",
      maximumScore: 0.45,
      requiredCriteria: [],
      allowedCriteria: [],
      minimumDistinctSources: 0,
    },
    note: "Negative control: category relevance does not compensate for an over-budget rate card.",
  }),
  {
    kind: "expected_decline",
    id: "consumer-ads-no-first-party-source",
    motionId: "consumer.ads",
    objective:
      "Build a Bengaluru customer acquisition segment for a wellness subscription.",
    connectedSources: [],
    expectedReason:
      "no first-party customer data source is connected; segment.build has no warehouse to build from",
    note:
      "The simulated world has no consented customer dataset, so this is an expected plan decline rather than a relevance evaluation.",
  },
  {
    kind: "expected_decline",
    id: "consumer-email-no-first-party-source",
    motionId: "consumer.email",
    objective:
      "Re-engage inactive Bengaluru customers with an explicitly consented email campaign.",
    connectedSources: [],
    expectedReason:
      "no first-party customer data source is connected; customer_base cannot be resolved",
    note:
      "The simulated world has neither customer records nor opt-in/lifecycle truth, so this is an expected plan decline rather than a relevance evaluation.",
  },
];

function sourceText(document: SourceDocument): string {
  return document.kind === "web"
    ? document.document.content
    : document.reviews.map((review) => review.text).join("\n");
}

function isGrounded(
  documents: readonly SourceDocument[],
  citation: DocumentaryCitation,
): boolean {
  const document = documents.find((candidate) =>
    candidate.kind === "web"
      ? candidate.document.sourceRef === citation.sourceRef
      : candidate.sourceRef === citation.sourceRef,
  );
  return (
    document !== undefined &&
    normalizeEvidence(sourceText(document)).includes(
      normalizeEvidence(citation.excerpt),
    )
  );
}

function distinctCitationSources(citations: readonly DocumentaryCitation[]) {
  return new Set(citations.map((citation) => citation.sourceRef)).size;
}

function scoreIsInExpectedRange(
  output: EvaluatedCandidate,
  expectation: FitExpectation,
): boolean {
  return (
    Number.isFinite(output.score) &&
    output.score >= 0 &&
    output.score <= 1 &&
    (expectation.minimumScore === undefined ||
      output.score >= expectation.minimumScore) &&
    (expectation.maximumScore === undefined ||
      output.score <= expectation.maximumScore)
  );
}

function criteriaMatch(
  output: EvaluatedCandidate,
  expectation: FitExpectation,
): boolean {
  return (
    output.criteria.every((criterion) =>
      expectation.allowedCriteria.includes(criterion),
    ) &&
    expectation.requiredCriteria.every((criterion) =>
      output.criteria.includes(criterion),
    )
  );
}

function checkCase(
  candidate: EvaluatedMotionCase,
  actual: EvaluatedCandidate,
): EvaluatedCaseResult {
  const documents =
    candidate.input.kind === "organization" ? candidate.input.documents : [];
  const groundedCitationCount =
    candidate.input.kind === "organization"
      ? actual.citations.filter((citation) => isGrounded(documents, citation))
          .length
      : 0;
  const citations =
    candidate.input.kind === "organization"
      ? groundedCitationCount === actual.citations.length
      : actual.citations.length === 0;
  const sourceCoverage =
    distinctCitationSources(actual.citations) >=
    candidate.expectation.minimumDistinctSources;
  const checks = {
    decision:
      actual.isFit === (candidate.expectation.expectedDecision === "fit"),
    score: scoreIsInExpectedRange(actual, candidate.expectation),
    criteria: criteriaMatch(actual, candidate.expectation),
    citations,
    sourceCoverage,
  };
  return {
    id: candidate.id,
    motionId: candidate.motionId,
    expectedDecision: candidate.expectation.expectedDecision,
    actual,
    citationCount: actual.citations.length,
    groundedCitationCount,
    checks,
    passed: Object.values(checks).every((check) => check),
  };
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function metrics(
  results: readonly EvaluatedCaseResult[],
  expectedDeclines: readonly ExpectedDeclineResult[],
): EvaluationMetrics {
  const truePositive = results.filter(
    (result) => result.expectedDecision === "fit" && result.actual.isFit,
  ).length;
  const falsePositive = results.filter(
    (result) => result.expectedDecision === "not_fit" && result.actual.isFit,
  ).length;
  const falseNegative = results.filter(
    (result) => result.expectedDecision === "fit" && !result.actual.isFit,
  ).length;
  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  const fitF1 =
    precision === null || recall === null || precision + recall === 0
      ? null
      : (2 * precision * recall) / (precision + recall);
  const citationCount = results.reduce(
    (total, result) => total + result.citationCount,
    0,
  );
  const groundedCitationCount = results.reduce(
    (total, result) => total + result.groundedCitationCount,
    0,
  );
  return {
    evaluatedCases: results.length,
    passedCases: results.filter((result) => result.passed).length,
    decisionAccuracy:
      results.length === 0
        ? 0
        : results.filter((result) => result.checks.decision).length /
          results.length,
    fitPrecision: precision,
    fitRecall: recall,
    fitF1,
    groundedCitationRate: ratio(groundedCitationCount, citationCount),
    expectedDeclines: expectedDeclines.length,
  };
}

/**
 * Evaluates only the cases with fixture-backed observations. The executor is
 * injected so this module never creates a model client, adapter, database
 * connection, message, or other external side effect.
 */
export async function evaluateSimulatedWorld(
  executor: EvaluationExecutor,
  cases: readonly SimulatedWorldCase[] = simulatedWorldCases,
): Promise<SimulatedWorldEvaluationReport> {
  const results: EvaluatedCaseResult[] = [];
  const expectedDeclines: ExpectedDeclineResult[] = [];
  for (const candidate of cases) {
    if (candidate.kind === "expected_decline") {
      expectedDeclines.push({
        id: candidate.id,
        motionId: candidate.motionId,
        expectedReason: candidate.expectedReason,
      });
      continue;
    }
    const actual = await executor.evaluate(candidate.input);
    results.push(checkCase(candidate, actual));
  }
  return {
    results,
    expectedDeclines,
    metrics: metrics(results, expectedDeclines),
  };
}
