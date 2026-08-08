import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  ApprovalSchema,
  CampaignSchema,
  ObjectiveSchema,
  PlanSchema,
  RunSchema,
  TargetSchema,
} from "../../../src/contracts";
import type { z } from "zod";
import type {
  ApproveCampaignRequestSchema,
  CreateCampaignRequestSchema,
  StartRunRequestSchema,
} from "../../../src/contracts/api";
import { PlanDataSchema } from "../../../src/contracts/steps";
import {
  approval,
  campaign,
  interaction,
  objective,
  plan,
  run,
  target,
} from "../../../src/db/schema";
import { resumeCampaignWorkflow, startCampaignWorkflow } from "./workflows";

async function database() {
  const module = await import("../../../src/db/client");
  return module.db;
}

export class CampaignApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CampaignApiError";
  }
}

export async function createCampaign(
  input: z.output<typeof CreateCampaignRequestSchema>,
) {
  const db = await database();
  const created = await db.transaction(async (transaction) => {
    const campaigns = await transaction
      .insert(campaign)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        status: "planning",
        operatingBudgetCents: input.budget.operating.amountMinor,
        commitBudgetCents: input.budget.commit.amountMinor,
      })
      .returning();
    const createdCampaign = CampaignSchema.parse(campaigns[0]);
    const objectives = await transaction
      .insert(objective)
      .values({
        campaignId: createdCampaign.id,
        prompt: input.objective,
        // The workflow replaces this boundary value with the compiled spec.
        compiledSpec: { objective: input.objective },
      })
      .returning();
    return {
      campaign: createdCampaign,
      objective: ObjectiveSchema.parse(objectives[0]),
    };
  });

  await startCampaignWorkflow(created.campaign.id, {
    workspaceId: input.workspaceId,
    campaignId: created.campaign.id,
    objective: input.objective,
    budget: input.budget,
  });
  return created;
}

export async function listCampaigns(workspaceId: string) {
  const db = await database();
  const campaigns = await db
    .select()
    .from(campaign)
    .where(eq(campaign.workspaceId, workspaceId))
    .orderBy(desc(campaign.createdAt));

  return Promise.all(
    campaigns.map(async (campaignRow) => {
      const latestPlans = await db
        .select({ spec: plan.spec })
        .from(plan)
        .where(eq(plan.campaignId, campaignRow.id))
        .orderBy(desc(plan.version))
        .limit(1);
      const replies = await db
        .select({ count: sql<number>`count(*)::integer` })
        .from(interaction)
        .where(
          and(
            eq(interaction.campaignId, campaignRow.id),
            eq(interaction.kind, "reply"),
          ),
        );
      const parsedPlan = PlanDataSchema.safeParse(
        latestPlans[0] === undefined ? undefined : latestPlans[0].spec,
      );
      return {
        id: campaignRow.id,
        name: campaignRow.name,
        status: campaignRow.status,
        motions: parsedPlan.success
          ? parsedPlan.data.motions.map((motion) => motion.motionId)
          : [],
        operatingBudgetCents: campaignRow.operatingBudgetCents,
        operatingSpentCents: campaignRow.operatingSpentCents,
        commitBudgetCents: campaignRow.commitBudgetCents,
        commitSpentCents: campaignRow.commitSpentCents,
        replyCount: replies[0] === undefined ? 0 : replies[0].count,
        createdAt: campaignRow.createdAt,
      };
    }),
  );
}

export async function campaignDetail(campaignId: string) {
  const db = await database();
  const campaigns = await db
    .select()
    .from(campaign)
    .where(eq(campaign.id, campaignId))
    .limit(1);
  if (campaigns[0] === undefined) {
    throw new CampaignApiError("campaign_not_found", "Campaign not found.", 404);
  }
  const objectives = await db
    .select()
    .from(objective)
    .where(eq(objective.campaignId, campaignId))
    .orderBy(asc(objective.createdAt))
    .limit(1);
  if (objectives[0] === undefined) {
    throw new CampaignApiError(
      "objective_not_found",
      "Campaign objective not found.",
      404,
    );
  }
  const plans = await db
    .select()
    .from(plan)
    .where(eq(plan.campaignId, campaignId))
    .orderBy(desc(plan.version))
    .limit(1);
  const targets = await db
    .select()
    .from(target)
    .where(eq(target.campaignId, campaignId))
    .orderBy(asc(target.createdAt));

  return {
    campaign: CampaignSchema.parse(campaigns[0]),
    objective: ObjectiveSchema.parse(objectives[0]),
    plan: plans[0] === undefined ? null : PlanSchema.parse(plans[0]),
    targets: targets.map((row) => TargetSchema.parse(row)),
  };
}

export async function approveCampaign(
  input: z.output<typeof ApproveCampaignRequestSchema>,
) {
  const db = await database();
  const approvals = await db
    .update(approval)
    .set({
      status: input.approved ? "approved" : "rejected",
      decidedAt: new Date(),
      decidedBy: input.decidedBy,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(approval.id, input.approvalId),
        eq(approval.campaignId, input.campaignId),
        eq(approval.status, "pending"),
      ),
    )
    .returning();
  if (approvals[0] === undefined) {
    throw new CampaignApiError(
      "approval_not_found",
      "Pending campaign approval not found.",
      404,
    );
  }
  const parsedApproval = ApprovalSchema.parse(approvals[0]);
  const campaigns = await db
    .update(campaign)
    .set({
      status: input.approved ? "approved" : "draft",
      updatedAt: new Date(),
    })
    .where(eq(campaign.id, input.campaignId))
    .returning();
  const updatedCampaign = CampaignSchema.parse(campaigns[0]);

  if (parsedApproval.runId !== null) {
    await resumeCampaignWorkflow(
      parsedApproval.runId,
      input.approved,
      input.decidedBy,
    );
  }
  return { approval: parsedApproval, campaignStatus: updatedCampaign.status };
}

export async function startRun(input: z.output<typeof StartRunRequestSchema>) {
  const db = await database();
  const campaigns = await db
    .select({ id: campaign.id })
    .from(campaign)
    .where(eq(campaign.id, input.campaignId))
    .limit(1);
  if (campaigns[0] === undefined) {
    throw new CampaignApiError("campaign_not_found", "Campaign not found.", 404);
  }
  const plans = await db
    .select({ id: plan.id })
    .from(plan)
    .where(eq(plan.campaignId, input.campaignId))
    .orderBy(desc(plan.version))
    .limit(1);
  const runs = await db
    .insert(run)
    .values({
      campaignId: input.campaignId,
      planId: plans[0] === undefined ? null : plans[0].id,
      kind: input.kind,
      status: "running",
      startedAt: new Date(),
    })
    .returning();
  const createdRun = RunSchema.parse(runs[0]);
  await startCampaignWorkflow(createdRun.id, {
    campaignId: input.campaignId,
    runId: createdRun.id,
    kind: input.kind,
  });
  return createdRun;
}
