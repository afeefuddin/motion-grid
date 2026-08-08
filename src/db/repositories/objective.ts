import { asc, eq } from "drizzle-orm";
import type { Objective } from "../../contracts";
import { NewObjectiveSchema, ObjectiveSchema } from "../../contracts";
import { db } from "../client";
import { objective } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewObjective } from "./types";

export const objectiveRepo = {
  async create(input: NewObjective) {
    const rows = await db
      .insert(objective)
      .values(NewObjectiveSchema.parse(input))
      .returning();
    return parseRow(ObjectiveSchema, rows[0], "objective create");
  },

  async byCampaign(campaignId: Objective["campaignId"]) {
    const rows = await db
      .select()
      .from(objective)
      .where(eq(objective.campaignId, campaignId))
      .orderBy(asc(objective.createdAt));
    return parseRows(ObjectiveSchema, rows);
  },
};
