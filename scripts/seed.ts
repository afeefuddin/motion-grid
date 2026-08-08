import { sql } from "drizzle-orm";
import {
  CampaignSpecSchema,
  NewCampaignSchema,
  NewObjectiveSchema,
  NewWorkspaceSchema,
} from "../src/contracts";
import { closeDatabase, db } from "../src/db/client";
import { marketBusinessRepo, targetRepo } from "../src/db/repositories";
import type { NewTarget } from "../src/db/repositories/types";
import { campaign, objective, workspace } from "../src/db/schema";
import type { Creator } from "../src/sim/schema";
import { simWorld } from "../src/sim/world";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const campaignId = "10000000-0000-4000-8000-000000000002";
const objectiveId = "10000000-0000-4000-8000-000000000003";

async function main(): Promise<void> {
  const workspaceValue = NewWorkspaceSchema.parse({
    id: workspaceId,
    name: "Namma Booking Technologies",
  });
  await db
    .insert(workspace)
    .values(workspaceValue)
    .onConflictDoUpdate({
      target: workspace.id,
      set: { name: workspaceValue.name, updatedAt: new Date() },
    });

  const campaignValue = NewCampaignSchema.parse({
    id: campaignId,
    workspaceId,
    name: "Bengaluru local-service growth",
    status: "draft",
    operatingBudgetCents: 5_000,
    operatingSpentCents: 0,
    commitBudgetCents: 2_50_00_000,
    commitSpentCents: 0,
    outcome: null,
  });
  await db
    .insert(campaign)
    .values(campaignValue)
    .onConflictDoUpdate({
      target: campaign.id,
      set: {
        name: campaignValue.name,
        operatingBudgetCents: campaignValue.operatingBudgetCents,
        commitBudgetCents: campaignValue.commitBudgetCents,
        updatedAt: new Date(),
      },
    });

  const preset = CampaignSpecSchema.parse({
    name: campaignValue.name,
    goal: "Find Bengaluru salons without reliable online booking, qualify them, and create a creator-assisted demo pipeline.",
    geography: "Bengaluru",
    motions: ["business.local", "creator"],
    targetCriteria: [
      "Independent salon or spa",
      "Weak or absent online booking journey",
      "Reachable owner or manager",
    ],
    discoveryQuery: "salon & spa",
    budget: {
      operating: { currency: "USD", amountMinor: 5_000 },
      commit: { currency: "INR", amountMinor: 2_50_00_000 },
    },
    channels: ["whatsapp", "email"],
    successMetric: "Qualified demos booked",
  });
  const objectiveValue = NewObjectiveSchema.parse({
    id: objectiveId,
    campaignId,
    prompt: preset.goal,
    compiledSpec: {
      preset,
      workspaceProfile: {
        icp: "Independent local-service businesses in urban India that lose bookings through weak websites or manual appointment flows.",
        proofPoints: [
          "Booking pages launch in under seven days",
          "WhatsApp reminders reduce missed appointments",
          "Mobile-first sites include payments and staff calendars",
        ],
        senderIdentities: {
          whatsapp: "+91 98765 43210",
          email: "growth@nammabooking.example",
        },
      },
    },
  });
  await db
    .insert(objective)
    .values(objectiveValue)
    .onConflictDoUpdate({
      target: objective.id,
      set: {
        prompt: objectiveValue.prompt,
        compiledSpec: objectiveValue.compiledSpec,
        updatedAt: new Date(),
      },
    });

  function creatorTarget(creator: Creator, index: number): NewTarget {
    return {
      id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      campaignId,
      kind: "person",
      relationship: "prospect",
      status: "discovered",
      externalRef: creator.id,
      name: creator.name,
      payload: {
        platform: creator.platform,
        handle: creator.handle,
        followerCount: creator.followers,
        rateCardCommitCents: creator.rateCard.reel.amountPaise,
        profile: {
          audienceGeography: creator.audience.geography,
          audienceInterests: creator.audience.interests,
          contentCategories: creator.contentCategories,
          engagementRate: creator.engagementRate,
          viewToFollowerRatio: creator.viewToFollowerRatio,
          fakeFollowerEstimate: creator.fakeFollowerEstimate,
        },
      },
    };
  }

  // Businesses live in the reusable catalog and become campaign targets only
  // after the Location Finder selects them.
  await targetRepo.bulkUpsert(simWorld.creators.map(creatorTarget));
  await marketBusinessRepo.upsert(simWorld.businesses, {
    geography: "Bengaluru",
    provenance: "seeded",
  });

  const counts = await db.execute(sql`
  select
    (select count(*) from workspace where id = ${workspaceId}) workspace_count,
    (select count(*) from campaign where id = ${campaignId}) campaign_count,
    (select count(*) from objective where id = ${objectiveId}) objective_count,
    (select count(*) from target where campaign_id = ${campaignId}) target_count
`);
  process.stdout.write(`${JSON.stringify(counts[0])}\n`);
  await closeDatabase();
}

void main();
