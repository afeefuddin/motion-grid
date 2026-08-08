import { z } from "zod";

export const motionSchema = z.enum(["creator", "business", "consumer"]);

export const campaignStatusSchema = z.enum([
  "draft",
  "planning",
  "awaiting_approval",
  "approved",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const campaignObjectiveSchema = z.object({
  workspaceId: z.string().min(1),
  campaignId: z.string().min(1),
  objective: z.string().trim().min(12).max(2_000),
});

export const planStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  capability: z.string(),
  behavior: z.enum(["read", "write"]),
  approvalRequired: z.boolean(),
});

export const campaignPlanSchema = z.object({
  campaignId: z.string(),
  motion: motionSchema,
  mode: z.string(),
  rationale: z.string(),
  assumptions: z.array(z.string()),
  expectedTargets: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  steps: z.array(planStepSchema),
  risks: z.array(z.string()),
  successMetrics: z.array(z.string()),
});

export type CampaignObjective = z.infer<typeof campaignObjectiveSchema>;
export type CampaignPlan = z.infer<typeof campaignPlanSchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type Motion = z.infer<typeof motionSchema>;
