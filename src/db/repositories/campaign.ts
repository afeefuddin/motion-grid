import { asc, eq } from "drizzle-orm";
import type { Campaign } from "../../contracts";
import { CampaignSchema, NewCampaignSchema } from "../../contracts";
import { db } from "../client";
import { campaign } from "../schema";
import { parseOptionalRow, parseRow, parseRows } from "./parse";
import type { NewCampaign } from "./types";

export const campaignRepo = {
  async create(input: NewCampaign) {
    const rows = await db
      .insert(campaign)
      .values(NewCampaignSchema.parse(input))
      .returning();
    return parseRow(CampaignSchema, rows[0], "campaign create");
  },

  async byId(id: Campaign["id"]) {
    const rows = await db
      .select()
      .from(campaign)
      .where(eq(campaign.id, id))
      .limit(1);
    return parseOptionalRow(CampaignSchema, rows[0]);
  },

  async list(workspaceId: Campaign["workspaceId"]) {
    const rows = await db
      .select()
      .from(campaign)
      .where(eq(campaign.workspaceId, workspaceId))
      .orderBy(asc(campaign.createdAt));
    return parseRows(CampaignSchema, rows);
  },

  async updateStatus(id: Campaign["id"], status: Campaign["status"]) {
    const rows = await db
      .update(campaign)
      .set({ status, updatedAt: new Date() })
      .where(eq(campaign.id, id))
      .returning();
    return parseOptionalRow(CampaignSchema, rows[0]);
  },

  async updateBudgetSpend(
    id: Campaign["id"],
    operating: Campaign["operatingSpentCents"],
    commit: Campaign["commitSpentCents"],
  ) {
    const rows = await db
      .update(campaign)
      .set({
        operatingSpentCents: operating,
        commitSpentCents: commit,
        updatedAt: new Date(),
      })
      .where(eq(campaign.id, id))
      .returning();
    return parseOptionalRow(CampaignSchema, rows[0]);
  },
};
