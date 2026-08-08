import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ApprovalSchema,
  AllocationSchema,
  CampaignSchema,
  CampaignConversationMessageSchema,
  ObjectiveSchema,
  PlanSchema,
  RunSchema,
  TargetSchema,
} from "../../../src/contracts";
import type { z } from "zod";
import type {
  ApproveCampaignRequestSchema,
  ContinueCampaignRequestSchema,
  CreateCampaignRequestSchema,
  StartRunRequestSchema,
} from "../../../src/contracts/api";
import { PlanDataSchema } from "../../../src/contracts/steps";
import {
  approval,
  allocation,
  campaign,
  campaignConversationMessage,
  interaction,
  objective,
  plan,
  run,
  target,
  workspace,
} from "../../../src/db/schema";
import {
  cancelCampaignWorkflow,
  startCampaignWorkflow,
} from "./workflows";

const provisionalBudget = {
  operating: { currency: "USD" as const, amountMinor: 100 },
  commit: { currency: "INR" as const, amountMinor: 0 },
};

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
  const planId = randomUUID();
  const created = await db.transaction(async (transaction) => {
    const workspaces = await transaction
      .select({
        name: workspace.name,
        connectedSources: workspace.connectedSources,
      })
      .from(workspace)
      .where(eq(workspace.id, input.workspaceId))
      .limit(1);
    if (workspaces[0] === undefined) {
      throw new CampaignApiError(
        "workspace_not_found",
        "Workspace not found.",
        404,
      );
    }
    const campaigns = await transaction
      .insert(campaign)
      .values({
        workspaceId: input.workspaceId,
        name: input.name ?? "Compiling campaign",
        status: "planning",
        operatingBudgetCents:
          input.budget?.operating.amountMinor ??
          provisionalBudget.operating.amountMinor,
        commitBudgetCents:
          input.budget?.commit.amountMinor ?? provisionalBudget.commit.amountMinor,
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
    await transaction.insert(run).values({
      id: createdCampaign.id,
      campaignId: createdCampaign.id,
      planId: null,
      kind: "discovery",
      status: "running",
      startedAt: new Date(),
    });
    await transaction.insert(campaignConversationMessage).values([
      {
        campaignId: createdCampaign.id,
        runId: createdCampaign.id,
        role: "operator",
        status: "sent",
        content: input.objective,
      },
      {
        campaignId: createdCampaign.id,
        runId: createdCampaign.id,
        role: "motiongrid",
        status: "running",
        content: "I’m turning that objective into a reviewable campaign route.",
      },
    ]);
    return {
      campaign: createdCampaign,
      objective: ObjectiveSchema.parse(objectives[0]),
      workspaceName: workspaces[0].name,
      connectedSources: workspaces[0].connectedSources,
    };
  });

  await startCampaignWorkflow(created.campaign.id, {
    workspaceId: input.workspaceId,
    campaignId: created.campaign.id,
    runId: created.campaign.id,
    planId,
    workspaceName: created.workspaceName,
    connectedSources: created.connectedSources,
    objective: input.objective,
    ...(input.budget === undefined ? {} : { budget: input.budget }),
  });
  return { campaign: created.campaign, objective: created.objective };
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
  const allocations = await db
    .select()
    .from(allocation)
    .where(eq(allocation.campaignId, campaignId))
    .orderBy(desc(allocation.createdAt));
  const approvals = await db
    .select()
    .from(approval)
    .where(eq(approval.campaignId, campaignId))
    .orderBy(asc(approval.requestedAt));
  const conversation = await db
    .select()
    .from(campaignConversationMessage)
    .where(eq(campaignConversationMessage.campaignId, campaignId))
    .orderBy(asc(campaignConversationMessage.createdAt));

  return {
    campaign: CampaignSchema.parse(campaigns[0]),
    objective: ObjectiveSchema.parse(objectives[0]),
    plan: plans[0] === undefined ? null : PlanSchema.parse(plans[0]),
    targets: targets.map((row) => TargetSchema.parse(row)),
    allocations: allocations.map((row) => AllocationSchema.parse(row)),
    approvals: approvals.map((row) => ApprovalSchema.parse(row)),
    conversation: conversation.map((row) =>
      CampaignConversationMessageSchema.parse(row),
    ),
  };
}

export async function deleteCampaign(campaignId: string) {
  const db = await database();
  const campaigns = await db
    .select({ id: campaign.id })
    .from(campaign)
    .where(eq(campaign.id, campaignId))
    .limit(1);
  if (campaigns[0] === undefined) {
    throw new CampaignApiError("campaign_not_found", "Campaign not found.", 404);
  }

  const activeRuns = await db
    .select({ id: run.id })
    .from(run)
    .where(
      and(
        eq(run.campaignId, campaignId),
        inArray(run.status, ["pending", "running", "paused"]),
      ),
    );

  try {
    await Promise.all(
      activeRuns.map((activeRun) => cancelCampaignWorkflow(activeRun.id)),
    );
  } catch {
    throw new CampaignApiError(
      "campaign_stop_failed",
      "The campaign was kept because its active agents could not all be stopped.",
      502,
    );
  }

  const deleted = await db
    .delete(campaign)
    .where(eq(campaign.id, campaignId))
    .returning({ id: campaign.id });
  if (deleted[0] === undefined) {
    throw new CampaignApiError("campaign_not_found", "Campaign not found.", 404);
  }
  return { campaignId: deleted[0].id, cancelledRunCount: activeRuns.length };
}

export async function continueCampaign(
  input: z.output<typeof ContinueCampaignRequestSchema>,
) {
  const db = await database();
  const runId = randomUUID();
  const planId = randomUUID();
  const created = await db.transaction(async (transaction) => {
    const context = await transaction
      .select({
        workspaceId: campaign.workspaceId,
        workspaceName: workspace.name,
        connectedSources: workspace.connectedSources,
        operatingBudgetCents: campaign.operatingBudgetCents,
        commitBudgetCents: campaign.commitBudgetCents,
        objectiveId: objective.id,
        objectivePrompt: objective.prompt,
      })
      .from(campaign)
      .innerJoin(workspace, eq(workspace.id, campaign.workspaceId))
      .innerJoin(objective, eq(objective.campaignId, campaign.id))
      .where(eq(campaign.id, input.campaignId))
      .orderBy(asc(objective.createdAt))
      .limit(1);
    const campaignContext = context[0];
    if (campaignContext === undefined) {
      throw new CampaignApiError(
        "campaign_context_missing",
        "Campaign workspace or objective is missing.",
        404,
      );
    }

    const amendedObjective = `${campaignContext.objectivePrompt}\n\nOperator amendment: ${input.message}`;
    await transaction
      .update(objective)
      .set({ prompt: amendedObjective, updatedAt: new Date() })
      .where(eq(objective.id, campaignContext.objectiveId));
    await transaction
      .update(campaign)
      .set({ status: "planning", updatedAt: new Date() })
      .where(eq(campaign.id, input.campaignId));
    await transaction
      .update(approval)
      .set({
        status: "rejected",
        decidedAt: new Date(),
        decidedBy: "operator-amendment",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(approval.campaignId, input.campaignId),
          eq(approval.status, "pending"),
        ),
      );

    const runs = await transaction
      .insert(run)
      .values({
        id: runId,
        campaignId: input.campaignId,
        planId: null,
        kind: "replan",
        status: "running",
        startedAt: new Date(),
      })
      .returning();
    const messages = await transaction
      .insert(campaignConversationMessage)
      .values([
        {
          campaignId: input.campaignId,
          runId,
          role: "operator",
          status: "sent",
          content: input.message,
        },
        {
          campaignId: input.campaignId,
          runId,
          role: "motiongrid",
          status: "running",
          content:
            "I’m revising the campaign route around that instruction. The plan will update as each agent finishes.",
        },
      ])
      .returning();

    return {
      context: campaignContext,
      objective: amendedObjective,
      run: RunSchema.parse(runs[0]),
      operatorMessage: CampaignConversationMessageSchema.parse(messages[0]),
      assistantMessage: CampaignConversationMessageSchema.parse(messages[1]),
    };
  });

  try {
    await startCampaignWorkflow(runId, {
      workspaceId: created.context.workspaceId,
      campaignId: input.campaignId,
      runId,
      planId,
      workspaceName: created.context.workspaceName,
      connectedSources: created.context.connectedSources,
      objective: created.objective,
      budget: {
        operating: {
          currency: "USD",
          amountMinor: created.context.operatingBudgetCents,
        },
        commit: {
          currency: "INR",
          amountMinor: created.context.commitBudgetCents,
        },
      },
    });
  } catch (error) {
    await db
      .update(run)
      .set({
        status: "failed",
        failureReason:
          error instanceof Error ? error.message : "Agent run failed to start.",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(run.id, runId));
    await db
      .update(campaignConversationMessage)
      .set({
        status: "failed",
        content:
          "I saved your instruction, but couldn’t start the revision. The last completed artifact is unchanged.",
        updatedAt: new Date(),
      })
      .where(eq(campaignConversationMessage.id, created.assistantMessage.id));
    throw error;
  }

  return {
    operatorMessage: created.operatorMessage,
    assistantMessage: created.assistantMessage,
    run: created.run,
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

  return { approval: parsedApproval, campaignStatus: updatedCampaign.status };
}

export async function startRun(input: z.output<typeof StartRunRequestSchema>) {
  const db = await database();
  const campaigns = await db
    .select({
      id: campaign.id,
      workspaceId: campaign.workspaceId,
      operatingBudgetCents: campaign.operatingBudgetCents,
      commitBudgetCents: campaign.commitBudgetCents,
    })
    .from(campaign)
    .where(eq(campaign.id, input.campaignId))
    .limit(1);
  if (campaigns[0] === undefined) {
    throw new CampaignApiError("campaign_not_found", "Campaign not found.", 404);
  }
  const workspaces = await db
    .select({
      name: workspace.name,
      connectedSources: workspace.connectedSources,
    })
    .from(workspace)
    .where(eq(workspace.id, campaigns[0].workspaceId))
    .limit(1);
  const objectives = await db
    .select({ prompt: objective.prompt })
    .from(objective)
    .where(eq(objective.campaignId, input.campaignId))
    .orderBy(asc(objective.createdAt))
    .limit(1);
  if (workspaces[0] === undefined || objectives[0] === undefined) {
    throw new CampaignApiError(
      "campaign_context_missing",
      "Campaign workspace or objective is missing.",
      409,
    );
  }
  const runs = await db
    .insert(run)
    .values({
      campaignId: input.campaignId,
      planId: null,
      kind: input.kind,
      status: "running",
      startedAt: new Date(),
    })
    .returning();
  const createdRun = RunSchema.parse(runs[0]);
  const planId = randomUUID();
  await startCampaignWorkflow(createdRun.id, {
    workspaceId: campaigns[0].workspaceId,
    campaignId: input.campaignId,
    runId: createdRun.id,
    planId,
    workspaceName: workspaces[0].name,
    connectedSources: workspaces[0].connectedSources,
    objective: objectives[0].prompt,
    budget: {
      operating: {
        currency: "USD",
        amountMinor: campaigns[0].operatingBudgetCents,
      },
      commit: {
        currency: "INR",
        amountMinor: campaigns[0].commitBudgetCents,
      },
    },
  });
  return createdRun;
}
