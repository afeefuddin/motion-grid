import { desc, eq } from "drizzle-orm";
import type { Plan } from "../../contracts";
import {
  NewMotionAllocationSchema,
  NewPlanSchema,
  PlanSchema,
} from "../../contracts";
import { db } from "../client";
import { motionAllocation, plan } from "../schema";
import { parseOptionalRow, parseRow } from "./parse";
import type { NewMotionAllocation, NewPlan } from "./types";

export const planRepo = {
  async create(input: NewPlan, allocations: NewMotionAllocation[] = []) {
    return db.transaction(async (transaction) => {
      const rows = await transaction
        .insert(plan)
        .values(NewPlanSchema.parse(input))
        .returning();
      const created = parseRow(PlanSchema, rows[0], "plan create");

      if (allocations.length > 0) {
        await transaction
          .insert(motionAllocation)
          .values(
            allocations.map((allocation) =>
              NewMotionAllocationSchema.parse(allocation),
            ),
          );
      }

      return created;
    });
  },

  async latestByCampaign(campaignId: Plan["campaignId"]) {
    const rows = await db
      .select()
      .from(plan)
      .where(eq(plan.campaignId, campaignId))
      .orderBy(desc(plan.version))
      .limit(1);
    return parseOptionalRow(PlanSchema, rows[0]);
  },

  async approve(id: Plan["id"]) {
    const rows = await db
      .update(plan)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(plan.id, id))
      .returning();
    return parseOptionalRow(PlanSchema, rows[0]);
  },
};
