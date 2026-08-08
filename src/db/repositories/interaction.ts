import { asc, eq } from "drizzle-orm";
import type { Interaction } from "../../contracts";
import { InteractionSchema, NewInteractionSchema } from "../../contracts";
import { db } from "../client";
import { interaction } from "../schema";
import { parseRow, parseRows } from "./parse";
import type { NewInteraction } from "./types";

export const interactionRepo = {
  async create(input: NewInteraction) {
    const rows = await db
      .insert(interaction)
      .values(NewInteractionSchema.parse(input))
      .returning();
    return parseRow(InteractionSchema, rows[0], "interaction create");
  },

  async byTarget(targetId: Interaction["targetId"]) {
    const rows = await db
      .select()
      .from(interaction)
      .where(eq(interaction.targetId, targetId))
      .orderBy(asc(interaction.occurredAt));
    return parseRows(InteractionSchema, rows);
  },

  async byCampaign(campaignId: Interaction["campaignId"]) {
    const rows = await db
      .select()
      .from(interaction)
      .where(eq(interaction.campaignId, campaignId))
      .orderBy(asc(interaction.occurredAt));
    return parseRows(InteractionSchema, rows);
  },
};
