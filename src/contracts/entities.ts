import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  allocation,
  approval,
  assessment,
  campaign,
  contact,
  edge,
  interaction,
  message,
  motionAllocation,
  objective,
  plan,
  policy,
  run,
  signal,
  suppression,
  target,
  toolCall,
  workspace,
} from "../db/schema";
import { CapabilityIdSchema, MotionIdSchema } from "./enums";
import {
  ConfidenceSchema,
  DocumentaryEvidencePayloadSchema,
  JsonValueSchema,
  NonnegativeCentsSchema,
  OrganizationTargetPayloadSchema,
  PersonTargetPayloadSchema,
  SegmentTargetPayloadSchema,
  StatisticalEvidencePayloadSchema,
} from "./payloads";

export const IdSchema = z.uuid();

const workspaceSelectBase = createSelectSchema(workspace);
const workspaceInsertBase = createInsertSchema(workspace);
export const WorkspaceSchema = workspaceSelectBase;
export const NewWorkspaceSchema = workspaceInsertBase;

const campaignSelectBase = createSelectSchema(campaign, {
  operatingBudgetCents: NonnegativeCentsSchema,
  operatingSpentCents: NonnegativeCentsSchema,
  commitBudgetCents: NonnegativeCentsSchema,
  commitSpentCents: NonnegativeCentsSchema,
  outcome: JsonValueSchema.nullable(),
});
const campaignInsertBase = createInsertSchema(campaign, {
  operatingBudgetCents: NonnegativeCentsSchema,
  operatingSpentCents: NonnegativeCentsSchema,
  commitBudgetCents: NonnegativeCentsSchema,
  commitSpentCents: NonnegativeCentsSchema,
  outcome: JsonValueSchema.nullable(),
});
export const CampaignSchema = campaignSelectBase;
export const NewCampaignSchema = campaignInsertBase;

export const ObjectiveSchema = createSelectSchema(objective, {
  compiledSpec: JsonValueSchema,
});
export const NewObjectiveSchema = createInsertSchema(objective, {
  compiledSpec: JsonValueSchema,
});

export const PlanSchema = createSelectSchema(plan, {
  version: z.int().positive(),
  spec: JsonValueSchema,
});
export const NewPlanSchema = createInsertSchema(plan, {
  version: z.int().positive(),
  spec: JsonValueSchema,
});

export const MotionAllocationSchema = createSelectSchema(motionAllocation, {
  operatingBudgetCents: NonnegativeCentsSchema,
  commitBudgetCents: NonnegativeCentsSchema,
  dependsOn: z.array(MotionIdSchema),
});
export const NewMotionAllocationSchema = createInsertSchema(motionAllocation, {
  operatingBudgetCents: NonnegativeCentsSchema,
  commitBudgetCents: NonnegativeCentsSchema,
  dependsOn: z.array(MotionIdSchema),
});

export const RunSchema = createSelectSchema(run);
export const NewRunSchema = createInsertSchema(run);

const targetSelectBase = createSelectSchema(target).omit({
  kind: true,
  payload: true,
});
const targetInsertBase = createInsertSchema(target).omit({
  kind: true,
  payload: true,
});
export const TargetSchema = z.discriminatedUnion("kind", [
  targetSelectBase.extend({
    kind: z.literal("organization"),
    payload: OrganizationTargetPayloadSchema,
  }),
  targetSelectBase.extend({
    kind: z.literal("person"),
    payload: PersonTargetPayloadSchema,
  }),
  targetSelectBase.extend({
    kind: z.literal("segment"),
    payload: SegmentTargetPayloadSchema,
  }),
]);
export const NewTargetSchema = z.discriminatedUnion("kind", [
  targetInsertBase.extend({
    kind: z.literal("organization"),
    payload: OrganizationTargetPayloadSchema,
  }),
  targetInsertBase.extend({
    kind: z.literal("person"),
    payload: PersonTargetPayloadSchema,
  }),
  targetInsertBase.extend({
    kind: z.literal("segment"),
    payload: SegmentTargetPayloadSchema,
  }),
]);

export const ContactSchema = createSelectSchema(contact);
export const NewContactSchema = createInsertSchema(contact);

const signalSelectBase = createSelectSchema(signal).omit({
  evidenceKind: true,
  payload: true,
});
const signalInsertBase = createInsertSchema(signal).omit({
  evidenceKind: true,
  payload: true,
});
export const SignalSchema = z.discriminatedUnion("evidenceKind", [
  signalSelectBase.extend({
    evidenceKind: z.literal("documentary"),
    payload: DocumentaryEvidencePayloadSchema,
  }),
  signalSelectBase.extend({
    evidenceKind: z.literal("statistical"),
    payload: StatisticalEvidencePayloadSchema,
  }),
]);
export const NewSignalSchema = z.discriminatedUnion("evidenceKind", [
  signalInsertBase.extend({
    evidenceKind: z.literal("documentary"),
    payload: DocumentaryEvidencePayloadSchema,
  }),
  signalInsertBase.extend({
    evidenceKind: z.literal("statistical"),
    payload: StatisticalEvidencePayloadSchema,
  }),
]);

export const EdgeSchema = createSelectSchema(edge, {
  confidence: ConfidenceSchema,
});
export const NewEdgeSchema = createInsertSchema(edge, {
  confidence: ConfidenceSchema,
});

export const AssessmentSchema = createSelectSchema(assessment, {
  score: ConfidenceSchema,
  droppedCount: z.int().nonnegative(),
  rubric: JsonValueSchema,
});
export const NewAssessmentSchema = createInsertSchema(assessment, {
  score: ConfidenceSchema,
  droppedCount: z.int().nonnegative(),
  rubric: JsonValueSchema,
});

export const AllocationSchema = createSelectSchema(allocation, {
  commitCents: NonnegativeCentsSchema,
});
export const NewAllocationSchema = createInsertSchema(allocation, {
  commitCents: NonnegativeCentsSchema,
});

export const MessageSchema = createSelectSchema(message, {
  evidenceIds: z.array(IdSchema),
});
export const NewMessageSchema = createInsertSchema(message, {
  evidenceIds: z.array(IdSchema),
});

export const InteractionSchema = createSelectSchema(interaction, {
  payload: JsonValueSchema.nullable(),
});
export const NewInteractionSchema = createInsertSchema(interaction, {
  payload: JsonValueSchema.nullable(),
});

export const ToolCallSchema = createSelectSchema(toolCall, {
  capabilityId: CapabilityIdSchema,
  input: JsonValueSchema,
  output: JsonValueSchema,
  operatingCostCents: NonnegativeCentsSchema,
  projected: z.boolean(),
  durationMs: z.int().nonnegative(),
});
export const NewToolCallSchema = createInsertSchema(toolCall, {
  capabilityId: CapabilityIdSchema,
  input: JsonValueSchema,
  output: JsonValueSchema,
  operatingCostCents: NonnegativeCentsSchema,
  projected: z.boolean(),
  durationMs: z.int().nonnegative(),
});

export const PolicySchema = createSelectSchema(policy, {
  config: JsonValueSchema,
});
export const NewPolicySchema = createInsertSchema(policy, {
  config: JsonValueSchema,
});

export const ApprovalSchema = createSelectSchema(approval);
export const NewApprovalSchema = createInsertSchema(approval);

export const SuppressionSchema = createSelectSchema(suppression);
export const NewSuppressionSchema = createInsertSchema(suppression);

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type MotionAllocation = z.infer<typeof MotionAllocationSchema>;
export type Run = z.infer<typeof RunSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type Allocation = z.infer<typeof AllocationSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Interaction = z.infer<typeof InteractionSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type Suppression = z.infer<typeof SuppressionSchema>;
