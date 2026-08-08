import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const searchLocalBusinesses = createTool({
  id: "search-local-businesses",
  description: "Estimate or discover physical businesses matching a local B2B target.",
  inputSchema: z.object({
    query: z.string().min(3),
    geography: z.string().min(2),
    limit: z.number().int().min(1).max(500).default(50),
    mode: z.enum(["estimate", "execute"]).default("estimate"),
    approvalId: z.string().optional(),
  }),
  outputSchema: z.object({
    provider: z.string(),
    estimatedRecords: z.number().int(),
    estimatedCostUsd: z.number(),
    status: z.enum(["estimated", "not-configured"]),
  }),
  execute: async ({ limit }) => {
    // Replace this explicit seam with the Outscraper adapter. The tool intentionally
    // cannot perform a paid request until provider configuration and persistence exist.
    return {
      provider: "outscraper",
      estimatedRecords: limit,
      estimatedCostUsd: Number((limit * 0.003).toFixed(2)),
      status: "not-configured" as const,
    };
  },
});
