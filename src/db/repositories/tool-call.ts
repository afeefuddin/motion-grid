import { asc, eq, sql } from "drizzle-orm";
import type { ToolCall } from "../../contracts";
import { NewToolCallSchema, ToolCallSchema } from "../../contracts";
import { db } from "../client";
import { toolCall } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewToolCall } from "./types";

export const toolCallRepo = {
  async create(input: NewToolCall) {
    const rows = await db
      .insert(toolCall)
      .values(NewToolCallSchema.parse(input))
      .returning();
    return parseRow(ToolCallSchema, rows[0], "tool call create");
  },

  async byRun(runId: ToolCall["runId"]) {
    const rows = await db
      .select()
      .from(toolCall)
      .where(eq(toolCall.runId, runId))
      .orderBy(asc(toolCall.createdAt));
    return parseRows(ToolCallSchema, rows);
  },

  async costByCampaign(campaignId: ToolCall["campaignId"]) {
    const rows = await db
      .select({
        operatingCostCents: sql<number>`coalesce(sum(${toolCall.operatingCostCents}), 0)::integer`,
      })
      .from(toolCall)
      .where(eq(toolCall.campaignId, campaignId));
    const row = rows[0];

    if (row === undefined) {
      throw new Error("tool call campaign cost did not return a row");
    }

    return row.operatingCostCents;
  },
};
