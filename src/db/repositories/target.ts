import { and, asc, eq, sql } from "drizzle-orm";
import type { Target } from "../../contracts";
import { NewTargetSchema, TargetSchema } from "../../contracts";
import { db } from "../client";
import { target } from "../schema";
import { parseOptionalRow, parseRows } from "./parse";
import type { NewTarget } from "./types";

export const targetRepo = {
  async bulkUpsert(inputs: NewTarget[]) {
    const deduplicated = new Map<string, NewTarget>();

    for (const input of inputs) {
      const value = NewTargetSchema.parse(input);
      deduplicated.set(
        JSON.stringify([value.campaignId, value.kind, value.externalRef]),
        value,
      );
    }

    const values = [...deduplicated.values()];
    if (values.length === 0) {
      return [];
    }

    const rows = await db
      .insert(target)
      .values(values)
      .onConflictDoUpdate({
        target: [target.campaignId, target.kind, target.externalRef],
        // Rediscovery refreshes source data without reversing explicit workflow state.
        set: {
          relationship: sql`excluded.relationship`,
          name: sql`excluded.name`,
          payload: sql`excluded.payload`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return parseRows(TargetSchema, rows);
  },

  async byCampaign(campaignId: Target["campaignId"]) {
    const rows = await db
      .select()
      .from(target)
      .where(eq(target.campaignId, campaignId))
      .orderBy(asc(target.createdAt));
    return parseRows(TargetSchema, rows);
  },

  async updateState(id: Target["id"], status: Target["status"]) {
    const rows = await db
      .update(target)
      .set({ status, updatedAt: new Date() })
      .where(eq(target.id, id))
      .returning();
    return parseOptionalRow(TargetSchema, rows[0]);
  },

  async byState(campaignId: Target["campaignId"], status: Target["status"]) {
    const rows = await db
      .select()
      .from(target)
      .where(and(eq(target.campaignId, campaignId), eq(target.status, status)))
      .orderBy(asc(target.createdAt));
    return parseRows(TargetSchema, rows);
  },
};
