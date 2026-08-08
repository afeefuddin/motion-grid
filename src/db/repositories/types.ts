import type { z } from "zod";
import type {
  NewAllocationSchema,
  NewApprovalSchema,
  NewAssessmentSchema,
  NewCampaignSchema,
  NewContactSchema,
  NewEdgeSchema,
  NewInteractionSchema,
  NewMessageSchema,
  NewMotionAllocationSchema,
  NewObjectiveSchema,
  NewPlanSchema,
  NewPolicySchema,
  NewRunSchema,
  NewSignalSchema,
  NewSuppressionSchema,
  NewTargetSchema,
  NewToolCallSchema,
  NewWorkspaceSchema,
} from "../../contracts";

export type NewWorkspace = z.infer<typeof NewWorkspaceSchema>;
export type NewCampaign = z.infer<typeof NewCampaignSchema>;
export type NewObjective = z.infer<typeof NewObjectiveSchema>;
export type NewPlan = z.infer<typeof NewPlanSchema>;
export type NewMotionAllocation = z.infer<typeof NewMotionAllocationSchema>;
export type NewRun = z.infer<typeof NewRunSchema>;
export type NewTarget = z.infer<typeof NewTargetSchema>;
export type NewContact = z.infer<typeof NewContactSchema>;
export type NewSignal = z.infer<typeof NewSignalSchema>;
export type NewEdge = z.infer<typeof NewEdgeSchema>;
export type NewAssessment = z.infer<typeof NewAssessmentSchema>;
export type NewAllocation = z.infer<typeof NewAllocationSchema>;
export type NewMessage = z.infer<typeof NewMessageSchema>;
export type NewInteraction = z.infer<typeof NewInteractionSchema>;
export type NewToolCall = z.infer<typeof NewToolCallSchema>;
export type NewPolicy = z.infer<typeof NewPolicySchema>;
export type NewApproval = z.infer<typeof NewApprovalSchema>;
export type NewSuppression = z.infer<typeof NewSuppressionSchema>;
