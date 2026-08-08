import { z } from "zod";
import {
  FoundPersonSchema,
  ReviewArtifactSchema,
  TargetCandidateSchema,
  WebFetchOutputSchema,
} from "./capabilities";
import { IdSchema, SignalSchema } from "./entities";
import {
  CapabilityIdSchema,
  ChannelSchema,
  defineValues,
  EdgeKindSchema,
  MotionIdSchema,
  PolicyDecisionSchema,
  TargetRelationshipSchema,
  TargetStatusSchema,
} from "./enums";
import {
  ConfidenceSchema,
  DocumentaryEvidencePayloadSchema,
  NonnegativeCentsSchema,
  StatisticalEvidencePayloadSchema,
} from "./payloads";

export const StepResult = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), reason: z.string().min(1) }),
  ]);

export const MoneySchema = z.discriminatedUnion("currency", [
  z.object({ currency: z.literal("USD"), amountMinor: NonnegativeCentsSchema }),
  z.object({ currency: z.literal("INR"), amountMinor: NonnegativeCentsSchema }),
]);

export const DualBudgetSchema = z.object({
  operating: z.object({
    currency: z.literal("USD"),
    amountMinor: NonnegativeCentsSchema,
  }),
  commit: z.object({
    currency: z.literal("INR"),
    amountMinor: NonnegativeCentsSchema,
  }),
});

export const CampaignSpecSchema = z.object({
  name: z.string().min(1),
  goal: z.string().min(1),
  geography: z.string().min(1),
  motions: z.array(MotionIdSchema).min(1),
  targetCriteria: z.array(z.string().min(1)).min(1),
  budget: DualBudgetSchema,
  channels: z.array(ChannelSchema),
  successMetric: z.string().min(1),
});

export const CompileObjectiveInputSchema = z.object({
  workspaceId: IdSchema,
  campaignId: IdSchema,
  objective: z.string().min(1),
  budget: DualBudgetSchema,
});
export const CompileObjectiveOutputSchema = StepResult(CampaignSpecSchema);

export const MotionPlanSchema = z.object({
  motionId: MotionIdSchema,
  capabilities: z.array(CapabilityIdSchema),
  operatingBudgetCents: NonnegativeCentsSchema,
  commitBudgetCents: NonnegativeCentsSchema,
  dependsOn: z.array(MotionIdSchema),
  rationale: z.string().min(1),
});
export const PolicyRequirementSchema = z.object({
  kind: z.string().min(1),
  description: z.string().min(1),
});
export const PlanDataSchema = z.object({
  campaignId: IdSchema,
  motions: z.array(MotionPlanSchema).min(1),
  policies: z.array(PolicyRequirementSchema),
  budget: DualBudgetSchema,
});
export const PlanInputSchema = z.object({
  campaignId: IdSchema,
  spec: CampaignSpecSchema,
});
export const PlanOutputSchema = StepResult(PlanDataSchema);

export const DiscoverInputSchema = z.object({
  campaignId: IdSchema,
  runId: IdSchema,
  motionId: MotionIdSchema,
  spec: CampaignSpecSchema,
});
export const DiscoverDataSchema = z.object({
  targets: z.array(TargetCandidateSchema),
});
export const DiscoverOutputSchema = StepResult(DiscoverDataSchema);

export const ObserveInputSchema = z.object({
  campaignId: IdSchema,
  runId: IdSchema,
  targetId: IdSchema,
  target: TargetCandidateSchema,
});
export const SourceDocumentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("web"), document: WebFetchOutputSchema }),
  z.object({
    kind: z.literal("reviews"),
    sourceRef: z.string().min(1),
    reviews: z.array(ReviewArtifactSchema),
  }),
]);
export const ObserveDataSchema = z.object({
  documents: z.array(SourceDocumentSchema),
});
export const ObserveOutputSchema = StepResult(ObserveDataSchema);

export const ExtractedEvidenceSchema = z.discriminatedUnion("evidenceKind", [
  z.object({
    evidenceKind: z.literal("documentary"),
    payload: DocumentaryEvidencePayloadSchema,
  }),
  z.object({
    evidenceKind: z.literal("statistical"),
    payload: StatisticalEvidencePayloadSchema,
  }),
]);
export const ExtractEvidenceInputSchema = z.object({
  campaignId: IdSchema,
  runId: IdSchema,
  targetId: IdSchema,
  documents: z.array(SourceDocumentSchema).min(1),
});
export const ExtractEvidenceDataSchema = z.object({
  signals: z.array(ExtractedEvidenceSchema),
});
export const ExtractEvidenceOutputSchema = StepResult(
  ExtractEvidenceDataSchema,
);

export const AssessInputSchema = z.object({
  campaignId: IdSchema,
  runId: IdSchema,
  targetId: IdSchema,
  signals: z.array(SignalSchema),
  rubric: z.array(z.string().min(1)).min(1),
  droppedCount: z.int().nonnegative(),
});
export const AssessDataSchema = z.object({
  score: ConfidenceSchema,
  isFit: z.boolean(),
  reason: z.string().min(1),
  status: z.enum(["fit", "not_fit"]),
  droppedCount: z.int().nonnegative(),
});
export const AssessOutputSchema = StepResult(AssessDataSchema);

export const FindContactInputSchema = z.object({
  campaignId: IdSchema,
  runId: IdSchema,
  targetId: IdSchema,
  externalRef: z.string().min(1),
  channels: z.array(ChannelSchema).min(1),
});
export const FindContactDataSchema = z.object({
  contact: FoundPersonSchema.nullable(),
  preferredChannel: ChannelSchema.nullable(),
});
export const FindContactOutputSchema = StepResult(FindContactDataSchema);

export const EvidenceSentenceSchema = z.object({
  text: z.string().min(1),
  evidenceId: IdSchema,
});
export const DraftInputSchema = z.object({
  campaignId: IdSchema,
  runId: IdSchema,
  targetId: IdSchema,
  workspaceName: z.string().min(1),
  contact: FoundPersonSchema,
  channel: ChannelSchema,
  signals: z.array(SignalSchema).min(1),
});
export const DraftDataSchema = z.object({
  channel: ChannelSchema,
  subject: z.string().min(1).nullable(),
  sentences: z.array(EvidenceSentenceSchema).min(1),
});
export const DraftOutputSchema = StepResult(DraftDataSchema);

export const PolicyGateInputSchema = z.object({
  campaignId: IdSchema,
  targetId: IdSchema,
  channel: ChannelSchema,
  relationship: TargetRelationshipSchema,
  address: z.string().min(1),
  operatingCostCents: NonnegativeCentsSchema,
  commitCostCents: NonnegativeCentsSchema,
});
export const PolicyGateDataSchema = z.object({
  decision: PolicyDecisionSchema,
  reason: z.string().min(1),
});
export const PolicyGateOutputSchema = StepResult(PolicyGateDataSchema);

export const SynthesizeInputSchema = z.object({
  campaignId: IdSchema,
  runId: IdSchema,
  targetIds: z.array(IdSchema),
});
export const DiscoveredEdgeSchema = z.object({
  fromTargetId: IdSchema,
  toTargetId: IdSchema,
  kind: EdgeKindSchema,
  evidenceId: IdSchema.nullable(),
  confidence: ConfidenceSchema,
});
export const SynthesizeDataSchema = z.object({
  edges: z.array(DiscoveredEdgeSchema),
  outcome: z.object({
    targetCount: z.int().nonnegative(),
    fitCount: z.int().nonnegative(),
    sentCount: z.int().nonnegative(),
    engagedCount: z.int().nonnegative(),
    operatingSpentCents: NonnegativeCentsSchema,
    commitSpentCents: NonnegativeCentsSchema,
  }),
});
export const SynthesizeOutputSchema = StepResult(SynthesizeDataSchema);

export const replyIntents = defineValues(
  "interested",
  "not_interested",
  "question",
  "meeting_request",
  "opt_out",
  "unknown",
);
export const ReplyIntentSchema = z.enum(replyIntents);
export const sentiments = defineValues("positive", "neutral", "negative");
export const SentimentSchema = z.enum(sentiments);
export const nextActions = defineValues(
  "reply",
  "book_meeting",
  "suppress",
  "review",
);
export const NextActionSchema = z.enum(nextActions);
export const ClassifyReplyInputSchema = z.object({
  campaignId: IdSchema,
  targetId: IdSchema,
  messageId: IdSchema.nullable(),
  channel: ChannelSchema,
  text: z.string().min(1),
});
export const ClassifyReplyDataSchema = z.object({
  intent: ReplyIntentSchema,
  sentiment: SentimentSchema,
  nextAction: NextActionSchema,
  confidence: ConfidenceSchema,
});
export const ClassifyReplyOutputSchema = StepResult(ClassifyReplyDataSchema);

export const TargetStateTransitionSchema = z.object({
  targetId: IdSchema,
  from: TargetStatusSchema,
  to: TargetStatusSchema,
});
