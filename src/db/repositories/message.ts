import { and, asc, eq } from "drizzle-orm";
import type { Message } from "../../contracts";
import { MessageSchema, NewMessageSchema } from "../../contracts";
import { db } from "../client";
import { message } from "../schema";
import { parseOptionalRow, parseRow, parseRows } from "./parse";
import type { NewMessage } from "./types";

export const messageRepo = {
  async create(input: NewMessage) {
    const rows = await db
      .insert(message)
      .values(NewMessageSchema.parse(input))
      .returning();
    return parseRow(MessageSchema, rows[0], "message create");
  },

  async byTarget(targetId: Message["targetId"]) {
    const rows = await db
      .select()
      .from(message)
      .where(eq(message.targetId, targetId))
      .orderBy(asc(message.createdAt));
    return parseRows(MessageSchema, rows);
  },

  async pendingApproval(campaignId: Message["campaignId"]) {
    const rows = await db
      .select()
      .from(message)
      .where(
        and(
          eq(message.campaignId, campaignId),
          eq(message.status, "pending_approval"),
        ),
      )
      .orderBy(asc(message.createdAt));
    return parseRows(MessageSchema, rows);
  },

  async approve(id: Message["id"]) {
    const rows = await db
      .update(message)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(message.id, id))
      .returning();
    return parseOptionalRow(MessageSchema, rows[0]);
  },

  async markSent(
    id: Message["id"],
    providerRef: NonNullable<Message["providerRef"]>,
    sentAt: NonNullable<Message["sentAt"]>,
  ) {
    const rows = await db
      .update(message)
      .set({
        status: "sent",
        providerRef,
        sentAt,
        updatedAt: new Date(),
      })
      .where(eq(message.id, id))
      .returning();
    return parseOptionalRow(MessageSchema, rows[0]);
  },
};
