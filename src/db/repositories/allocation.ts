import { asc, eq } from "drizzle-orm";
import type { Allocation } from "../../contracts";
import { AllocationSchema, NewAllocationSchema } from "../../contracts";
import { db } from "../client";
import { allocation } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewAllocation } from "./types";

export const allocationRepo = {
  async create(input: NewAllocation) {
    const rows = await db
      .insert(allocation)
      .values(NewAllocationSchema.parse(input))
      .returning();
    return parseRow(AllocationSchema, rows[0], "allocation create");
  },

  async byCampaign(campaignId: Allocation["campaignId"]) {
    const rows = await db
      .select()
      .from(allocation)
      .where(eq(allocation.campaignId, campaignId))
      .orderBy(asc(allocation.createdAt));
    return parseRows(AllocationSchema, rows);
  },
};
