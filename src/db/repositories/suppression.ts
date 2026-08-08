import { and, eq, isNull, or } from "drizzle-orm";
import type { Suppression } from "../../contracts";
import { NewSuppressionSchema, SuppressionSchema } from "../../contracts";
import { db } from "../client";
import { suppression } from "../schema";
import { parseRow } from "./parse";
import type { NewSuppression } from "./types";

export const suppressionRepo = {
  async isSuppressed(
    workspaceId: Suppression["workspaceId"],
    campaignId: Suppression["campaignId"],
    channel: Suppression["channel"],
    address: Suppression["address"],
  ) {
    const campaignScope =
      campaignId === null
        ? and(eq(suppression.scope, "campaign"), isNull(suppression.campaignId))
        : and(
            eq(suppression.scope, "campaign"),
            eq(suppression.campaignId, campaignId),
          );
    const rows = await db
      .select({ id: suppression.id })
      .from(suppression)
      .where(
        and(
          eq(suppression.workspaceId, workspaceId),
          eq(suppression.channel, channel),
          eq(suppression.address, address),
          or(eq(suppression.scope, "workspace"), campaignScope),
        ),
      )
      .limit(1);
    return rows.length === 1;
  },

  async add(input: NewSuppression) {
    const rows = await db
      .insert(suppression)
      .values(NewSuppressionSchema.parse(input))
      .onConflictDoNothing()
      .returning();

    if (rows[0] !== undefined) {
      return parseRow(SuppressionSchema, rows[0], "suppression add");
    }

    const value = NewSuppressionSchema.parse(input);
    const existing = await db
      .select()
      .from(suppression)
      .where(
        and(
          eq(suppression.workspaceId, value.workspaceId),
          value.campaignId === null || value.campaignId === undefined
            ? isNull(suppression.campaignId)
            : eq(suppression.campaignId, value.campaignId),
          eq(suppression.channel, value.channel),
          eq(suppression.address, value.address),
        ),
      )
      .limit(1);
    return parseRow(SuppressionSchema, existing[0], "suppression lookup");
  },
};
