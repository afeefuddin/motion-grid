import { z } from "zod";
import {
  ApprovalSchema,
  AllocationSchema,
  CampaignConversationMessageSchema,
  CampaignSchema,
  EdgeSchema,
  IdSchema,
  InteractionSchema,
  MessageSchema,
  ObjectiveSchema,
  PlanSchema,
  RunSchema,
  SignalSchema,
  TargetSchema,
} from "./entities";
import {
  CampaignStatusSchema,
  CapabilityIdSchema,
  ChannelSchema,
  InteractionKindSchema,
  MotionIdSchema,
  RunKindSchema,
  TargetStatusSchema,
} from "./enums";
import { NonnegativeCentsSchema } from "./payloads";
import {
  AdapterChoiceSchema,
  CapabilityRankingSchema,
  DeclinedMotionSchema,
  DualBudgetSchema,
  PlanDataSchema,
  ReplanReferenceSchema,
} from "./steps";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export const CreateCampaignRequestSchema = z.object({
  workspaceId: IdSchema,
  name: z.string().min(1).optional(),
  objective: z.string().min(1),
  budget: DualBudgetSchema.optional(),
});
export const CreateCampaignResponseSchema = z.object({
  campaign: CampaignSchema,
  objective: ObjectiveSchema,
});

export const ListCampaignsRequestSchema = z.object({
  workspaceId: IdSchema,
});
export const CampaignSummarySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  status: CampaignStatusSchema,
  motions: z.array(MotionIdSchema),
  operatingBudgetCents: NonnegativeCentsSchema,
  operatingSpentCents: NonnegativeCentsSchema,
  commitBudgetCents: NonnegativeCentsSchema,
  commitSpentCents: NonnegativeCentsSchema,
  replyCount: z.int().nonnegative(),
  createdAt: z.date(),
});
export const ListCampaignsResponseSchema = z.object({
  campaigns: z.array(CampaignSummarySchema),
});

export const CampaignDetailRequestSchema = z.object({ campaignId: IdSchema });
export const CampaignDetailResponseSchema = z.object({
  campaign: CampaignSchema,
  objective: ObjectiveSchema,
  plan: PlanSchema.nullable(),
  targets: z.array(TargetSchema),
  allocations: z.array(AllocationSchema),
  approvals: z.array(ApprovalSchema),
  conversation: z.array(CampaignConversationMessageSchema),
});

export const DeleteCampaignRequestSchema = z.object({ campaignId: IdSchema });
export const DeleteCampaignResponseSchema = z.object({
  campaignId: IdSchema,
  cancelledRunCount: z.int().nonnegative(),
});

export const ContinueCampaignRequestSchema = z.object({
  campaignId: IdSchema,
  message: z.string().trim().min(1).max(4_000),
});
export const ContinueCampaignResponseSchema = z.object({
  operatorMessage: CampaignConversationMessageSchema,
  assistantMessage: CampaignConversationMessageSchema,
  run: RunSchema,
});

export const ApproveCampaignRequestSchema = z.object({
  campaignId: IdSchema,
  approvalId: IdSchema,
  approved: z.boolean(),
  decidedBy: z.string().min(1),
});
export const ApproveCampaignResponseSchema = z.object({
  approval: ApprovalSchema,
  campaignStatus: CampaignStatusSchema,
});

export const StartRunRequestSchema = z.object({
  campaignId: IdSchema,
  kind: RunKindSchema,
});
export const StartRunResponseSchema = z.object({ run: RunSchema });

export const ApproveMessageRequestSchema = z.object({
  messageId: IdSchema,
  approved: z.boolean(),
  decidedBy: z.string().min(1),
});
export const ApproveMessageResponseSchema = z.object({
  message: MessageSchema,
  approval: ApprovalSchema,
});

export const StreamRequestSchema = z.object({
  runId: IdSchema,
  lastEventId: z.string().min(1).optional(),
});

export const TwilioWebhookRequestSchema = z.object({
  MessageSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  Body: z.string(),
});
export const ResendWebhookRequestSchema = z.object({
  type: z.string().min(1),
  created_at: z.iso.datetime(),
  data: z.object({
    email_id: z.string().min(1),
    to: z.array(z.email()).min(1),
  }),
});
export const WebhookResponseSchema = z.object({ received: z.literal(true) });

const EventEnvelopeSchema = z.object({
  id: z.string().min(1),
  runId: IdSchema,
  campaignId: IdSchema,
  occurredAt: z.iso.datetime(),
});

export const PlanDeltaEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("plan.delta"),
  data: z.object({
    sequence: z.int().nonnegative(),
    delta: z.string(),
    snapshot: PlanDataSchema.nullable(),
  }),
});

export const MotionSelectedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("motion_selected"),
  data: z.object({
    motionId: MotionIdSchema,
    rationale: z.string().min(1),
  }),
});

export const MotionDeclinedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("motion_declined"),
  data: DeclinedMotionSchema,
});

export const CapabilityRankedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("capability_ranked"),
  data: CapabilityRankingSchema,
});

export const BindingChosenEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("binding_chosen"),
  data: z.object({
    capabilityId: CapabilityIdSchema,
    chosen: AdapterChoiceSchema,
  }),
});

export const PolicyWarningEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("policy_warning"),
  data: z.object({
    warning: z.object({
      kind: z.literal("budget_threshold"),
      utilizationBasisPoints: z.int().nonnegative(),
    }),
    reason: z.string().min(1),
  }),
});

export const ReplanStartedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("replan_started"),
  data: ReplanReferenceSchema,
});

export const TargetStateEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("target.state"),
  data: z.object({
    targetId: IdSchema,
    from: TargetStatusSchema.nullable(),
    to: TargetStatusSchema,
    reason: z.string().min(1).nullable(),
  }),
});

export const CostTickEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("cost.tick"),
  data: z.object({
    capabilityId: CapabilityIdSchema,
    operatingDeltaCents: NonnegativeCentsSchema,
    operatingTotalCents: NonnegativeCentsSchema,
    commitDeltaCents: NonnegativeCentsSchema,
    commitTotalCents: NonnegativeCentsSchema,
    projected: z.boolean(),
  }),
});

export const SignalAddedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("signal.added"),
  data: z.object({ signal: SignalSchema }),
});

export const AssessmentRecordedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("assessment.recorded"),
  data: z.object({
    targetId: IdSchema,
    score: z.number().min(0).max(1),
    isFit: z.boolean(),
    reason: z.string().min(1),
    droppedCount: z.int().nonnegative(),
    delta: z.string().default("Assessment recorded."),
  }),
});

export const EdgeDiscoveredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("edge.discovered"),
  data: z.object({ edge: EdgeSchema }),
});

export const ApprovalRequiredEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("approval.required"),
  data: z.object({ approval: ApprovalSchema }),
});

export const MessageSentEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("message.sent"),
  data: z.object({ message: MessageSchema }),
});

export const InteractionReceivedEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("interaction.received"),
  data: z.object({
    interaction: InteractionSchema,
    channel: ChannelSchema,
    kind: InteractionKindSchema,
  }),
});

export const RunDoneEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("run.done"),
  data: z.object({
    run: RunSchema,
    targetCounts: z.record(TargetStatusSchema, z.int().nonnegative()),
  }),
});

export const AgentStatusEventSchema = EventEnvelopeSchema.extend({
  type: z.literal("agent.status"),
  data: z.object({
    agentId: z.string().min(1),
    label: z.string().min(1),
    status: z.enum(["running", "completed", "failed"]),
    detail: z.string().min(1),
  }),
});

export const SseEventSchema = z.discriminatedUnion("type", [
  AgentStatusEventSchema,
  PlanDeltaEventSchema,
  MotionSelectedEventSchema,
  MotionDeclinedEventSchema,
  CapabilityRankedEventSchema,
  BindingChosenEventSchema,
  PolicyWarningEventSchema,
  ReplanStartedEventSchema,
  TargetStateEventSchema,
  CostTickEventSchema,
  SignalAddedEventSchema,
  AssessmentRecordedEventSchema,
  EdgeDiscoveredEventSchema,
  ApprovalRequiredEventSchema,
  MessageSentEventSchema,
  InteractionReceivedEventSchema,
  RunDoneEventSchema,
]);

export type SseEvent = z.infer<typeof SseEventSchema>;
