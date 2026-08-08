import { asc, eq } from "drizzle-orm";
import type { Signal } from "../../contracts";
import { NewSignalSchema, SignalSchema } from "../../contracts";
import { db } from "../client";
import { signal } from "../schema";
import { parseRows } from "./parse";
import type { NewSignal } from "./types";

export const signalRepo = {
  async bulkCreate(inputs: NewSignal[]) {
    if (inputs.length === 0) {
      return [];
    }

    const rows = await db
      .insert(signal)
      .values(inputs.map((input) => NewSignalSchema.parse(input)))
      .returning();
    return parseRows(SignalSchema, rows);
  },

  async byTarget(targetId: Signal["targetId"]) {
    const rows = await db
      .select()
      .from(signal)
      .where(eq(signal.targetId, targetId))
      .orderBy(asc(signal.createdAt));
    return parseRows(SignalSchema, rows);
  },

  async byCampaign(campaignId: Signal["campaignId"]) {
    const rows = await db
      .select()
      .from(signal)
      .where(eq(signal.campaignId, campaignId))
      .orderBy(asc(signal.createdAt));
    return parseRows(SignalSchema, rows);
  },
};
