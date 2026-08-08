import { asc, eq } from "drizzle-orm";
import type { Approval } from "../../contracts";
import { ApprovalSchema, NewApprovalSchema } from "../../contracts";
import { db } from "../client";
import { approval } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewApproval } from "./types";

export const approvalRepo = {
  async create(input: NewApproval) {
    const rows = await db
      .insert(approval)
      .values(NewApprovalSchema.parse(input))
      .returning();
    return parseRow(ApprovalSchema, rows[0], "approval create");
  },

  async byCampaign(campaignId: Approval["campaignId"]) {
    const rows = await db
      .select()
      .from(approval)
      .where(eq(approval.campaignId, campaignId))
      .orderBy(asc(approval.createdAt));
    return parseRows(ApprovalSchema, rows);
  },
};
