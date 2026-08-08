import { asc, eq, or } from "drizzle-orm";
import type { Edge } from "../../contracts";
import { EdgeSchema, NewEdgeSchema } from "../../contracts";
import { db } from "../client";
import { edge } from "../schema";
import { parseRows } from "./parse";
import type { NewEdge } from "./types";

export const edgeRepo = {
  async bulkCreate(inputs: NewEdge[]) {
    if (inputs.length === 0) {
      return [];
    }

    const rows = await db
      .insert(edge)
      .values(inputs.map((input) => NewEdgeSchema.parse(input)))
      .onConflictDoNothing()
      .returning();
    return parseRows(EdgeSchema, rows);
  },

  async byCampaign(campaignId: Edge["campaignId"]) {
    const rows = await db
      .select()
      .from(edge)
      .where(eq(edge.campaignId, campaignId))
      .orderBy(asc(edge.createdAt));
    return parseRows(EdgeSchema, rows);
  },

  async byTarget(targetId: Edge["fromTargetId"]) {
    const rows = await db
      .select()
      .from(edge)
      .where(or(eq(edge.fromTargetId, targetId), eq(edge.toTargetId, targetId)))
      .orderBy(asc(edge.createdAt));
    return parseRows(EdgeSchema, rows);
  },
};
