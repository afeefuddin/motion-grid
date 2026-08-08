import { asc, eq } from "drizzle-orm";
import type { MotionAllocation } from "../../contracts";
import {
  MotionAllocationSchema,
  NewMotionAllocationSchema,
} from "../../contracts";
import { db } from "../client";
import { motionAllocation } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewMotionAllocation } from "./types";

export const motionAllocationRepo = {
  async create(input: NewMotionAllocation) {
    const rows = await db
      .insert(motionAllocation)
      .values(NewMotionAllocationSchema.parse(input))
      .returning();
    return parseRow(
      MotionAllocationSchema,
      rows[0],
      "motion allocation create",
    );
  },

  async byPlan(planId: MotionAllocation["planId"]) {
    const rows = await db
      .select()
      .from(motionAllocation)
      .where(eq(motionAllocation.planId, planId))
      .orderBy(asc(motionAllocation.createdAt));
    return parseRows(MotionAllocationSchema, rows);
  },
};
