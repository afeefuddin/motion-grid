import assert from "node:assert/strict";
import test from "node:test";
import { SignalSchema } from "../../contracts/entities";
import {
  AssessDataSchema,
  CampaignSpecSchema,
  ClassifyReplyDataSchema,
  DraftDataSchema,
  DualBudgetSchema,
  ExtractEvidenceDataSchema,
  PlanDataSchema,
} from "../../contracts/steps";
import { assessor, runAssessor } from "./assessor";
import { drafter, runDrafter } from "./drafter";
import { evidenceExtractor, runEvidenceExtractor } from "./evidence-extractor";
import { heavyAgentModel, lightAgentModel, midAgentModel } from "./models";
import { objectiveCompiler, runObjectiveCompiler } from "./objective-compiler";
import { planner, runPlanner } from "./planner";
import { replyClassifier, runReplyClassifier } from "./reply-classifier";
import type { StructuredAgent } from "./runner";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const campaignId = "00000000-0000-4000-8000-000000000002";
const targetId = "00000000-0000-4000-8000-000000000003";
const runId = "00000000-0000-4000-8000-000000000004";
const messageId = "00000000-0000-4000-8000-000000000005";
const signalId = "00000000-0000-4000-8000-000000000006";

function fixtureAgent<Output>(object: Output): StructuredAgent<Output> {
  return {
    async generate() {
      return { object };
    },
  };
}

test("agents use the verified model tiers", () => {
  assert.equal(objectiveCompiler.model, heavyAgentModel);
  assert.equal(planner.model, heavyAgentModel);
  assert.equal(evidenceExtractor.model, midAgentModel);
  assert.equal(assessor.model, midAgentModel);
  assert.equal(drafter.model, midAgentModel);
  assert.equal(replyClassifier.model, lightAgentModel);
});

test("each agent owns its frozen structured-output schema", async () => {
  const objectiveOptions = await objectiveCompiler.getDefaultOptions();
  const plannerOptions = await planner.getDefaultOptions();
  const evidenceOptions = await evidenceExtractor.getDefaultOptions();
  const assessorOptions = await assessor.getDefaultOptions();
  const drafterOptions = await drafter.getDefaultOptions();
  const replyOptions = await replyClassifier.getDefaultOptions();

  assert.equal(objectiveOptions.structuredOutput.schema, CampaignSpecSchema);
  assert.equal(plannerOptions.structuredOutput.schema, PlanDataSchema);
  assert.equal(
    evidenceOptions.structuredOutput.schema,
    ExtractEvidenceDataSchema,
  );
  assert.equal(assessorOptions.structuredOutput.schema, AssessDataSchema);
  assert.equal(drafterOptions.structuredOutput.schema, DraftDataSchema);
  assert.equal(replyOptions.structuredOutput.schema, ClassifyReplyDataSchema);
});

test("standalone runners validate fixture input and schema-bound output", async () => {
  const budget = DualBudgetSchema.parse({
    operating: { currency: "USD", amountMinor: 2_000 },
    commit: { currency: "INR", amountMinor: 500_000 },
  });
  const spec = CampaignSpecSchema.parse({
    name: "Bengaluru salon pipeline",
    goal: "Book meetings with salons that lack online booking",
    geography: "Bengaluru",
    motions: ["business.local"],
    targetCriteria: ["salon", "no online booking"],
    budget,
    channels: ["whatsapp", "email"],
    successMetric: "Meetings booked",
  });
  const compiled = await runObjectiveCompiler(
    {
      workspaceId,
      campaignId,
      objective: "Find Bengaluru salons without online booking",
      budget,
    },
    fixtureAgent(spec),
  );
  assert.deepEqual(compiled, { ok: true, data: spec });

  const planData = PlanDataSchema.parse({
    campaignId,
    motions: [
      {
        motionId: "business.local",
        capabilities: [
          "geo.query",
          "web.fetch",
          "reviews.fetch",
          "people.find",
          "message.send",
        ],
        operatingBudgetCents: 2_000,
        commitBudgetCents: 0,
        dependsOn: [],
        rationale:
          "Discover and qualify local salons before approved outreach.",
      },
    ],
    policies: [
      {
        kind: "require_approval",
        description: "Approve every outbound message.",
      },
    ],
    budget,
  });
  const planned = await runPlanner(
    { campaignId, spec },
    fixtureAgent(planData),
  );
  assert.deepEqual(planned, { ok: true, data: planData });

  const extractedData = ExtractEvidenceDataSchema.parse({
    signals: [
      {
        evidenceKind: "documentary",
        payload: {
          sourceRef: "web:salon-1",
          excerpt: "Appointments are available by phone.",
          verified: false,
          implication: "The website has no online booking path.",
          strength: 0.9,
        },
      },
    ],
  });
  const extracted = await runEvidenceExtractor(
    {
      campaignId,
      runId,
      targetId,
      documents: [
        {
          kind: "web",
          document: {
            sourceRef: "web:salon-1",
            url: "https://example.com",
            contentType: "text/html",
            content: "Appointments are available by phone.",
            fetchedAt: "2026-08-08T08:00:00.000Z",
          },
        },
      ],
    },
    fixtureAgent(extractedData),
  );
  assert.deepEqual(extracted, { ok: true, data: extractedData });

  const signal = SignalSchema.parse({
    id: signalId,
    campaignId,
    targetId,
    runId,
    evidenceKind: "documentary",
    payload: {
      sourceRef: "web:salon-1",
      excerpt: "Appointments are available by phone.",
      verified: true,
      implication: "The website has no online booking path.",
      strength: 0.9,
    },
    createdAt: new Date("2026-08-08T08:00:00.000Z"),
    updatedAt: new Date("2026-08-08T08:00:00.000Z"),
  });
  const assessment = AssessDataSchema.parse({
    score: 0.88,
    isFit: true,
    reason: "Verified evidence shows a booking gap.",
    status: "fit",
    droppedCount: 0,
  });
  const assessed = await runAssessor(
    {
      campaignId,
      runId,
      targetId,
      signals: [signal],
      rubric: ["booking_gap: no reliable online booking path"],
      droppedCount: 0,
    },
    fixtureAgent(assessment),
  );
  assert.deepEqual(assessed, { ok: true, data: assessment });

  const draft = DraftDataSchema.parse({
    channel: "whatsapp",
    subject: null,
    sentences: [
      {
        text: "I noticed appointments on your site are available by phone.",
        evidenceId: signalId,
      },
    ],
  });
  const drafted = await runDrafter(
    {
      campaignId,
      runId,
      targetId,
      workspaceName: "MotionGrid",
      contact: {
        name: "Asha",
        role: "Owner",
        email: "asha@example.com",
        phone: "+919876543210",
        confidence: 0.9,
      },
      channel: "whatsapp",
      signals: [signal],
    },
    fixtureAgent(draft),
  );
  assert.deepEqual(drafted, { ok: true, data: draft });

  const classification = ClassifyReplyDataSchema.parse({
    intent: "opt_out",
    sentiment: "negative",
    nextAction: "suppress",
    confidence: 0.99,
  });
  const classified = await runReplyClassifier(
    {
      campaignId,
      targetId,
      messageId,
      channel: "whatsapp",
      text: "Please stop messaging me.",
    },
    fixtureAgent(classification),
  );
  assert.deepEqual(classified, { ok: true, data: classification });
});
