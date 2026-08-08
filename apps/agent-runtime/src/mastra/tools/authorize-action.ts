import { createTool } from "@mastra/core/tools";
import { evaluateAction } from "@motiongrid/policy";
import { z } from "zod";

export const authorizeAction = createTool({
  id: "authorize-action",
  description: "Apply deterministic budget and approval policy before a capability executes.",
  inputSchema: z.object({
    workspaceId: z.string(),
    campaignId: z.string(),
    capability: z.string(),
    risk: z.enum(["read", "paid-read", "external-write", "destructive-write"]),
    estimatedCostUsd: z.number().nonnegative(),
    approvalId: z.string().optional(),
  }),
  outputSchema: z.object({
    allowed: z.boolean(),
    requiresApproval: z.boolean(),
    reasons: z.array(z.string()),
  }),
  execute: async (input) => evaluateAction(input),
});
