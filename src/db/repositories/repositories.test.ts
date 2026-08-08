import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  AllocationSchema,
  ApprovalSchema,
  AssessmentSchema,
  CampaignSchema,
  ContactSchema,
  EdgeSchema,
  InteractionSchema,
  MessageSchema,
  MotionAllocationSchema,
  ObjectiveSchema,
  PlanSchema,
  PolicySchema,
  RunSchema,
  SignalSchema,
  SuppressionSchema,
  TargetSchema,
  ToolCallSchema,
  WorkspaceSchema,
} from "../../contracts";
import { closeDatabase, db } from "../client";
import { workspace } from "../schema";
import {
  allocationRepo,
  approvalRepo,
  assessmentRepo,
  campaignRepo,
  contactRepo,
  edgeRepo,
  interactionRepo,
  messageRepo,
  motionAllocationRepo,
  objectiveRepo,
  planRepo,
  policyRepo,
  runRepo,
  signalRepo,
  suppressionRepo,
  targetRepo,
  toolCallRepo,
  workspaceRepo,
} from "./index";

const workspaceId = randomUUID();

after(async () => {
  await db.delete(workspace).where(eq(workspace.id, workspaceId));
  await closeDatabase();
});

const only = <T>(values: T[]): T => {
  assert.equal(values.length, 1);
  const value = values[0];

  if (value === undefined) {
    throw new Error("expected one repository result");
  }

  return value;
};

test("all entities round-trip through their contract repositories", async (context) => {
  const campaignId = randomUUID();
  const planId = randomUUID();
  const runId = randomUUID();
  const organizationId = randomUUID();
  const personId = randomUUID();
  const contactId = randomUUID();
  const signalId = randomUUID();
  const messageId = randomUUID();

  await context.test(
    "workspace, campaign, objective, and dual budgets",
    async () => {
      const createdWorkspace = await workspaceRepo.seed({
        id: workspaceId,
        name: "Repository test workspace",
      });
      assert.deepStrictEqual(
        WorkspaceSchema.parse(await workspaceRepo.get(workspaceId)),
        createdWorkspace,
      );

      const createdCampaign = await campaignRepo.create({
        id: campaignId,
        workspaceId,
        name: "Bengaluru launch",
        operatingBudgetCents: 5_000,
        operatingSpentCents: 0,
        commitBudgetCents: 2_500_000,
        commitSpentCents: 0,
        outcome: null,
      });
      assert.deepStrictEqual(
        CampaignSchema.parse(await campaignRepo.byId(campaignId)),
        createdCampaign,
      );
      assert.deepStrictEqual(
        only(await campaignRepo.list(workspaceId)),
        createdCampaign,
      );
      const approvedCampaign = await campaignRepo.updateStatus(
        campaignId,
        "approved",
      );
      assert.ok(approvedCampaign);
      assert.equal(approvedCampaign.status, "approved");

      const updatedBudget = await campaignRepo.updateBudgetSpend(
        campaignId,
        731,
        125_000,
      );
      assert.ok(updatedBudget);
      assert.equal(updatedBudget.operatingSpentCents, 731);
      assert.equal(updatedBudget.commitSpentCents, 125_000);

      const createdObjective = await objectiveRepo.create({
        campaignId,
        prompt: "Find local businesses with weak online booking experiences.",
        compiledSpec: { locality: "Bengaluru", limit: 60 },
      });
      assert.deepStrictEqual(
        ObjectiveSchema.parse(only(await objectiveRepo.byCampaign(campaignId))),
        createdObjective,
      );
    },
  );

  await context.test(
    "versioned plans, motion allocations, and runs",
    async () => {
      const createdPlan = await planRepo.create(
        {
          id: planId,
          campaignId,
          version: 1,
          spec: { motions: ["business.local", "creator"] },
        },
        [
          {
            planId,
            campaignId,
            motionId: "business.local",
            operatingBudgetCents: 2_000,
            commitBudgetCents: 0,
            dependsOn: [],
          },
        ],
      );
      assert.deepStrictEqual(
        PlanSchema.parse(await planRepo.latestByCampaign(campaignId)),
        createdPlan,
      );
      const approvedPlan = await planRepo.approve(planId);
      assert.ok(approvedPlan);
      assert.equal(approvedPlan.status, "approved");

      const planAllocation = only(await motionAllocationRepo.byPlan(planId));
      assert.deepStrictEqual(
        MotionAllocationSchema.parse(planAllocation),
        planAllocation,
      );

      const creatorAllocation = await motionAllocationRepo.create({
        planId,
        campaignId,
        motionId: "creator",
        operatingBudgetCents: 500,
        commitBudgetCents: 1_500_000,
        dependsOn: ["business.local"],
      });
      assert.deepStrictEqual(
        MotionAllocationSchema.parse(
          (await motionAllocationRepo.byPlan(planId))[1],
        ),
        creatorAllocation,
      );

      const createdRun = await runRepo.create({
        id: runId,
        campaignId,
        planId,
        kind: "discovery",
      });
      assert.deepStrictEqual(
        RunSchema.parse(only(await runRepo.byCampaign(campaignId))),
        createdRun,
      );
      const updatedRun = await runRepo.updateStatus(runId, "running");
      assert.ok(updatedRun);
      assert.equal(updatedRun.status, "running");

      const completedRun = await runRepo.complete(runId);
      assert.ok(completedRun);
      assert.equal(completedRun.status, "completed");
      assert.ok(completedRun.completedAt);
      assert.equal(completedRun.failureReason, null);

      const failedRunId = randomUUID();
      await runRepo.create({
        id: failedRunId,
        campaignId,
        planId,
        kind: "replan",
      });
      const failedRun = await runRepo.fail(
        failedRunId,
        "The objective compiler failed.",
      );
      assert.ok(failedRun);
      assert.equal(failedRun.status, "failed");
      assert.ok(failedRun.completedAt);
      assert.equal(failedRun.failureReason, "The objective compiler failed.");
    },
  );

  await context.test(
    "campaign-scoped target deduplication and target state",
    async () => {
      const inserted = await targetRepo.bulkUpsert([
        {
          id: randomUUID(),
          campaignId,
          kind: "organization",
          relationship: "prospect",
          externalRef: "place:indiranagar:1",
          name: "Old duplicate name",
          payload: {
            address: "100 Feet Road",
            locality: "Indiranagar",
            categories: ["gym"],
            websiteUrl: null,
            phone: "+919900000001",
          },
        },
        {
          id: organizationId,
          campaignId,
          kind: "organization",
          relationship: "prospect",
          externalRef: "place:indiranagar:1",
          name: "Indiranagar Strength",
          payload: {
            address: "100 Feet Road",
            locality: "Indiranagar",
            categories: ["gym"],
            websiteUrl: null,
            phone: "+919900000001",
          },
        },
        {
          id: personId,
          campaignId,
          kind: "person",
          relationship: "prospect_partner",
          externalRef: "instagram:fit-with-asha",
          name: "Asha Rao",
          payload: {
            platform: "instagram",
            handle: "fit_with_asha",
            followerCount: 24_000,
            rateCardCommitCents: 2_500_000,
          },
        },
      ]);
      assert.equal(inserted.length, 2);

      const initialOrganization = inserted.find(
        (entry) => entry.kind === "organization",
      );
      if (initialOrganization === undefined) {
        throw new Error("organization target was not inserted");
      }

      const followUp = only(
        await targetRepo.bulkUpsert([
          {
            campaignId,
            kind: "organization",
            relationship: "prospect",
            externalRef: "place:indiranagar:1",
            name: "Indiranagar Strength Updated",
            status: "observed",
            payload: {
              address: "100 Feet Road",
              locality: "Indiranagar",
              categories: ["gym"],
              websiteUrl: "https://example.com",
              phone: "+919900000001",
            },
          },
        ]),
      );
      assert.equal(followUp.id, initialOrganization.id);
      assert.equal((await targetRepo.byCampaign(campaignId)).length, 2);
      assert.deepStrictEqual(TargetSchema.parse(followUp), followUp);
      const updatedTarget = await targetRepo.updateState(personId, "fit");
      assert.ok(updatedTarget);
      assert.equal(updatedTarget.status, "fit");
      assert.equal(
        only(await targetRepo.byState(campaignId, "fit")).id,
        personId,
      );
    },
  );

  await context.test("contacts, signals, edges, and assessments", async () => {
    const createdContact = await contactRepo.create({
      id: contactId,
      campaignId,
      targetId: organizationId,
      channel: "whatsapp",
      address: "+919900000001",
      displayName: "Owner",
      consentBasis: "legitimate_interest",
      verified: true,
    });
    assert.deepStrictEqual(
      ContactSchema.parse(only(await contactRepo.byTarget(organizationId))),
      createdContact,
    );

    const createdSignals = await signalRepo.bulkCreate([
      {
        id: signalId,
        campaignId,
        targetId: organizationId,
        runId,
        evidenceKind: "documentary",
        payload: {
          sourceRef: "fixture://business/1",
          excerpt: "No online booking, had to DM on Instagram.",
          verified: false,
          implication: "Booking demand is handled manually.",
          strength: 0.5,
        },
      },
      {
        campaignId,
        targetId: organizationId,
        runId,
        evidenceKind: "statistical",
        payload: {
          metric: "review_count",
          value: 120,
          baseline: 50,
          method: "fixture",
          window: "all_time",
          implication: "Established customer demand.",
          strength: 0.5,
        },
      },
    ]);
    assert.deepStrictEqual(
      await signalRepo.byTarget(organizationId),
      createdSignals,
    );
    const documentary = SignalSchema.parse(createdSignals[0]);
    assert.equal(documentary.evidenceKind, "documentary");
    if (documentary.evidenceKind === "documentary") {
      assert.equal(documentary.payload.verified, false);
    }

    const createdEdge = only(
      await edgeRepo.bulkCreate([
        {
          campaignId,
          fromTargetId: personId,
          toTargetId: organizationId,
          kind: "mentions",
          evidenceId: signalId,
          confidence: 0.5,
        },
      ]),
    );
    assert.deepStrictEqual(
      EdgeSchema.parse(only(await edgeRepo.byCampaign(campaignId))),
      createdEdge,
    );
    assert.deepStrictEqual(
      only(await edgeRepo.byTarget(organizationId)),
      createdEdge,
    );

    const createdAssessment = await assessmentRepo.create(
      {
        campaignId,
        targetId: organizationId,
        runId,
        score: 0.5,
        isFit: true,
        reason: "Manual booking pain is directly evidenced.",
        droppedCount: 1,
        rubric: { fit: "booking_gap" },
      },
      [
        {
          campaignId,
          targetId: organizationId,
          runId,
          evidenceKind: "documentary",
          payload: {
            sourceRef: "fixture://business/1",
            excerpt: "Bookings are accepted by phone.",
            verified: true,
            implication: "The workflow is manual.",
            strength: 0.5,
          },
        },
      ],
    );
    assert.deepStrictEqual(
      AssessmentSchema.parse(
        only(await assessmentRepo.byTarget(organizationId)),
      ),
      createdAssessment,
    );
    assert.equal((await signalRepo.byCampaign(campaignId)).length, 3);
  });

  await context.test(
    "allocations, messages, interactions, and tool calls",
    async () => {
      const createdAllocation = await allocationRepo.create({
        campaignId,
        targetId: personId,
        motionId: "creator",
        commitCents: 2_500_000,
        selected: true,
        reason: "Best eligible reach under the commit budget.",
      });
      assert.deepStrictEqual(
        AllocationSchema.parse(
          only(await allocationRepo.byCampaign(campaignId)),
        ),
        createdAllocation,
      );

      const createdMessage = await messageRepo.create({
        id: messageId,
        campaignId,
        targetId: organizationId,
        contactId,
        runId,
        channel: "whatsapp",
        status: "pending_approval",
        body: "We noticed your booking flow is manual. Open to a quick demo?",
        evidenceIds: [signalId],
      });
      assert.deepStrictEqual(
        MessageSchema.parse(only(await messageRepo.byTarget(organizationId))),
        createdMessage,
      );
      assert.equal(
        only(await messageRepo.pendingApproval(campaignId)).id,
        messageId,
      );
      const approvedMessage = await messageRepo.approve(messageId);
      assert.ok(approvedMessage);
      assert.equal(approvedMessage.status, "approved");
      const sentMessage = await messageRepo.markSent(
        messageId,
        "provider-message-1",
        new Date(),
      );
      assert.ok(sentMessage);
      assert.equal(sentMessage.status, "sent");

      const createdInteraction = await interactionRepo.create({
        campaignId,
        targetId: organizationId,
        messageId,
        channel: "whatsapp",
        kind: "reply",
        providerRef: "provider-reply-1",
        body: "Yes, send details.",
        occurredAt: new Date(),
        payload: { intent: "positive" },
      });
      assert.deepStrictEqual(
        InteractionSchema.parse(
          only(await interactionRepo.byCampaign(campaignId)),
        ),
        createdInteraction,
      );
      assert.deepStrictEqual(
        only(await interactionRepo.byTarget(organizationId)),
        createdInteraction,
      );

      const createdToolCall = await toolCallRepo.create({
        campaignId,
        runId,
        targetId: organizationId,
        capabilityId: "web.fetch",
        adapterId: "sim.market",
        input: { url: "https://example.com" },
        output: { status: 200 },
        operatingCostCents: 17,
        projected: false,
        durationMs: 12,
      });
      assert.deepStrictEqual(
        ToolCallSchema.parse(only(await toolCallRepo.byRun(runId))),
        createdToolCall,
      );
      assert.equal(await toolCallRepo.costByCampaign(campaignId), 17);
    },
  );

  await context.test("policies, approvals, and suppressions", async () => {
    const createdPolicy = await policyRepo.create({
      workspaceId,
      campaignId,
      kind: "outreach_approval",
      config: { channels: ["whatsapp"] },
      enabled: true,
    });
    assert.deepStrictEqual(
      PolicySchema.parse(only(await policyRepo.byWorkspace(workspaceId))),
      createdPolicy,
    );

    const createdApproval = await approvalRepo.create({
      campaignId,
      runId,
      messageId,
      decision: "require_approval",
      status: "approved",
      reason: "First-touch outreach requires review.",
      decidedAt: new Date(),
      decidedBy: "test-user",
    });
    assert.deepStrictEqual(
      ApprovalSchema.parse(only(await approvalRepo.byCampaign(campaignId))),
      createdApproval,
    );

    assert.equal(
      await suppressionRepo.isSuppressed(
        workspaceId,
        campaignId,
        "whatsapp",
        "+919900000099",
      ),
      false,
    );
    const createdSuppression = await suppressionRepo.add({
      workspaceId,
      campaignId,
      scope: "campaign",
      channel: "whatsapp",
      address: "+919900000099",
      reason: "opt_out",
    });
    assert.deepStrictEqual(
      SuppressionSchema.parse(createdSuppression),
      createdSuppression,
    );
    assert.equal(
      await suppressionRepo.isSuppressed(
        workspaceId,
        campaignId,
        "whatsapp",
        "+919900000099",
      ),
      true,
    );
  });
});
