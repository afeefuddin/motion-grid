import { and, asc, eq } from "drizzle-orm";
import {
  type CampaignConversationMessage,
  CampaignConversationMessageSchema,
  NewCampaignConversationMessageSchema,
} from "../../contracts";
import { db } from "../client";
import { campaignConversationMessage } from "../schema";
import { parseOptionalRow, parseRow, parseRows } from "./parse";
import type { NewCampaignConversationMessage } from "./types";

export const campaignConversationMessageRepo = {
  async create(input: NewCampaignConversationMessage) {
    const rows = await db
      .insert(campaignConversationMessage)
      .values(NewCampaignConversationMessageSchema.parse(input))
      .returning();
    return parseRow(
      CampaignConversationMessageSchema,
      rows[0],
      "campaign conversation message create",
    );
  },

  async byCampaign(campaignId: CampaignConversationMessage["campaignId"]) {
    const rows = await db
      .select()
      .from(campaignConversationMessage)
      .where(eq(campaignConversationMessage.campaignId, campaignId))
      .orderBy(asc(campaignConversationMessage.createdAt));
    return parseRows(CampaignConversationMessageSchema, rows);
  },

  async updateAssistantForRun(
    runId: string,
    status: CampaignConversationMessage["status"],
    content: string,
  ) {
    const rows = await db
      .update(campaignConversationMessage)
      .set({ status, content, updatedAt: new Date() })
      .where(
        and(
          eq(campaignConversationMessage.runId, runId),
          eq(campaignConversationMessage.role, "motiongrid"),
        ),
      )
      .returning();
    return parseOptionalRow(CampaignConversationMessageSchema, rows[0]);
  },
};
