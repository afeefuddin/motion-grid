import { asc, eq } from "drizzle-orm";
import type { Run } from "../../contracts";
import { NewRunSchema, RunSchema } from "../../contracts";
import { db } from "../client";
import { run } from "../schema";
import { parseOptionalRow, parseRow, parseRows } from "./parse";
import type { NewRun } from "./types";

export const runRepo = {
  async create(input: NewRun) {
    const rows = await db
      .insert(run)
      .values(NewRunSchema.parse(input))
      .returning();
    return parseRow(RunSchema, rows[0], "run create");
  },

  async byCampaign(campaignId: Run["campaignId"]) {
    const rows = await db
      .select()
      .from(run)
      .where(eq(run.campaignId, campaignId))
      .orderBy(asc(run.createdAt));
    return parseRows(RunSchema, rows);
  },

  async updateStatus(id: Run["id"], status: Run["status"]) {
    const rows = await db
      .update(run)
      .set({ status, updatedAt: new Date() })
      .where(eq(run.id, id))
      .returning();
    return parseOptionalRow(RunSchema, rows[0]);
  },
};
