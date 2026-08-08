import { z } from "zod";

const contracts: typeof import("./index") = require("./index");

const id = "00000000-0000-4000-8000-000000000001";
const id2 = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-08-08T00:00:00.000Z");
const iso = now.toISOString();
const base = { id, createdAt: now, updatedAt: now };
const organizationPayload = {
  address: "12 CMH Road",
  locality: "Indiranagar",
  categories: ["salon"],
  websiteUrl: "https://example.com",
  phone: "+91 98765 43210",
};
const personPayload = {
  platform: "instagram",
  handle: "@asha",
  followerCount: 12_000,
  rateCardCommitCents: 2_500_000,
};
const segmentPayload = {
  description: "Bengaluru wellness shoppers",
  estimatedSize: 25_000,
  criteria: { city: "Bengaluru" },
};
const documentaryPayload = {
  sourceRef: "review:1",
  excerpt: "Had to DM on Instagram.",
  verified: true,
  implication: "Booking flow is fragmented.",
  strength: 0.9,
};
const statisticalPayload = {
  metric: "rating",
  value: 3.2,
  baseline: 4.1,
  method: "mean",
  window: "90d",
  implication: "Rating trails peers.",
  strength: 0.7,
};
const targetCandidate = {
  kind: "organization",
  externalRef: "business:1",
  name: "Asha Wellness",
  payload: organizationPayload,
};
const workspace = { ...base, name: "MotionGrid", connectedSources: [] };
const campaign = {
  ...base,
  workspaceId: id,
  name: "Bengaluru launch",
  status: "draft",
  operatingBudgetCents: 5_000,
  operatingSpentCents: 0,
  commitBudgetCents: 15_000_000,
  commitSpentCents: 0,
  outcome: null,
};
const objective = {
  ...base,
  campaignId: id,
  prompt: "Find local wellness businesses",
  compiledSpec: { goal: "book meetings" },
};
const plan = {
  ...base,
  campaignId: id,
  version: 1,
  status: "draft",
  spec: { motions: ["business.local"] },
};
const motionAllocation = {
  ...base,
  planId: id,
  campaignId: id,
  motionId: "business.local",
  operatingBudgetCents: 5_000,
  commitBudgetCents: 0,
  dependsOn: [],
};
const run = {
  ...base,
  campaignId: id,
  planId: id,
  kind: "discovery",
  status: "pending",
  startedAt: null,
  completedAt: null,
  failureReason: null,
};
const target = {
  ...base,
  campaignId: id,
  motionId: "business.local",
  kind: "organization",
  relationship: "prospect",
  status: "discovered",
  externalRef: "business:1",
  name: "Asha Wellness",
  payload: organizationPayload,
};
const contact = {
  ...base,
  campaignId: id,
  targetId: id,
  channel: "whatsapp",
  address: "+919876543210",
  displayName: "Asha",
  consentBasis: "legitimate_interest",
  verified: true,
};
const signal = {
  ...base,
  campaignId: id,
  targetId: id,
  runId: id,
  evidenceKind: "documentary",
  payload: documentaryPayload,
};
const edge = {
  ...base,
  campaignId: id,
  fromTargetId: id,
  toTargetId: id2,
  kind: "mentions",
  evidenceId: id,
  confidence: 0.8,
};
const assessment = {
  ...base,
  campaignId: id,
  targetId: id,
  runId: id,
  score: 0.8,
  isFit: true,
  reason: "Clear booking pain",
  droppedCount: 0,
  rubric: { booking: 1 },
};
const allocation = {
  ...base,
  campaignId: id,
  targetId: id,
  motionId: "creator",
  commitCents: 2_500_000,
  selected: true,
  reason: "Within budget",
};
const message = {
  ...base,
  campaignId: id,
  targetId: id,
  contactId: id,
  runId: id,
  channel: "whatsapp",
  status: "draft",
  subject: null,
  body: "Could we help with your booking flow?",
  evidenceIds: [id],
  providerRef: null,
  sentAt: null,
};
const interaction = {
  ...base,
  campaignId: id,
  targetId: id,
  messageId: id,
  channel: "whatsapp",
  kind: "reply",
  providerRef: "SM1",
  body: "Interested",
  occurredAt: now,
  payload: null,
};
const toolCall = {
  ...base,
  campaignId: id,
  runId: id,
  targetId: id,
  capabilityId: "geo.query",
  adapterId: "market.geo",
  input: { query: "salon" },
  output: { count: 1 },
  operatingCostCents: 1,
  projected: true,
  durationMs: 50,
};
const policy = {
  ...base,
  workspaceId: id,
  campaignId: id,
  kind: "approval_threshold",
  config: { threshold: 100 },
  enabled: true,
};
const approval = {
  ...base,
  campaignId: id,
  runId: id,
  messageId: id,
  decision: "require_approval",
  status: "pending",
  reason: "External send",
  requestedAt: now,
  decidedAt: null,
  decidedBy: null,
};
const suppression = {
  ...base,
  workspaceId: id,
  campaignId: id,
  scope: "campaign",
  channel: "email",
  address: "owner@example.com",
  reason: "opt_out",
};
const budget = {
  operating: { currency: "USD", amountMinor: 5_000 },
  commit: { currency: "INR", amountMinor: 15_000_000 },
};
const campaignSpec = {
  name: "Bengaluru launch",
  goal: "Book meetings",
  geography: "Bengaluru",
  motions: ["business.local"],
  targetCriteria: ["booking friction"],
  budget,
  channels: ["whatsapp"],
  successMetric: "meetings_booked",
};
const rankingWeights = {
  cost: 0.25,
  freshness: 0.25,
  confidence: 0.25,
  coverage: 0.25,
};
const adapterCandidate = {
  adapterId: "market.geo",
  mode: "sim",
  dimensionScores: {
    cost: 1,
    freshness: 1,
    confidence: 0.95,
    coverage: 1,
  },
  totalScore: 0.9875,
  eligible: true,
  reason: "Highest eligible score.",
};
const capabilityRanking = {
  capabilityId: "geo.query",
  weights: rankingWeights,
  weightsRationale: "Balanced for a local discovery campaign.",
  candidates: [adapterCandidate],
};
const adapterChoice = { adapterId: "market.geo", mode: "sim" };
const rankedBinding = { ...capabilityRanking, chosen: adapterChoice };
const declinedMotion = {
  motionId: "consumer.ads",
  reason: "No first-party customer data source is connected.",
};
const replanReference = {
  planId: id,
  trigger: "operating_budget_cap",
  reason: "The operating budget was reduced during the run.",
};
const motionPlan = {
  motionId: "business.local",
  capabilities: ["geo.query"],
  operatingBudgetCents: 5_000,
  commitBudgetCents: 0,
  dependsOn: [],
  rationale: "Find local businesses",
};
const planData = {
  campaignId: id,
  motions: [motionPlan],
  policies: [{ kind: "approval", description: "Approve sends" }],
  budget,
};
const webDocument = {
  sourceRef: "web:1",
  url: "https://example.com",
  contentType: "text/html",
  content: "<html></html>",
  fetchedAt: iso,
};
const review = { id: "review:1", rating: 2, text: "No reply", occurredAt: iso };
const foundPerson = {
  name: "Asha Rao",
  role: "Owner",
  email: "asha@example.com",
  phone: "+919876543210",
  confidence: 0.9,
};
const sourceDocument = { kind: "web", document: webDocument };
const eventBase = { id: "event-1", runId: id, campaignId: id, occurredAt: iso };

const cases = new Map<z.ZodType, unknown>();
const add = (schema: z.ZodType, example: unknown) => cases.set(schema, example);
const addMany = (schemas: z.ZodType[], example: unknown) => {
  for (const schema of schemas) add(schema, example);
};

addMany([contracts.MotionIdSchema], "business.local");
addMany([contracts.WorkspaceSourceSchema], "first_party_customers");
addMany([contracts.TargetKindSchema], "organization");
addMany([contracts.TargetRelationshipSchema], "prospect");
addMany([contracts.CampaignStatusSchema], "draft");
addMany([contracts.TargetStatusSchema], "discovered");
addMany([contracts.RunKindSchema], "discovery");
addMany([contracts.RunStatusSchema], "pending");
addMany([contracts.ChannelSchema], "whatsapp");
addMany([contracts.EvidenceKindSchema], "documentary");
addMany([contracts.EdgeKindSchema], "mentions");
addMany([contracts.PolicyDecisionSchema], "allow");
addMany([contracts.AdapterModeSchema], "sim");
addMany([contracts.ApprovalStatusSchema], "pending");
addMany([contracts.MessageStatusSchema], "draft");
addMany([contracts.InteractionKindSchema], "reply");
addMany([contracts.SuppressionScopeSchema], "campaign");
addMany([contracts.CapabilityIdSchema], "geo.query");
addMany([contracts.IdSchema], id);
addMany([contracts.NonnegativeCentsSchema], 1);
addMany([contracts.ConfidenceSchema], 0.5);
addMany([contracts.JsonValueSchema], { ok: true });
addMany([contracts.OrganizationTargetPayloadSchema], organizationPayload);
addMany([contracts.PersonTargetPayloadSchema], personPayload);
addMany([contracts.SegmentTargetPayloadSchema], segmentPayload);
addMany([contracts.TargetPayloadSchema], organizationPayload);
addMany([contracts.DocumentaryEvidencePayloadSchema], documentaryPayload);
addMany([contracts.StatisticalEvidencePayloadSchema], statisticalPayload);
addMany([contracts.EvidencePayloadSchema], documentaryPayload);
addMany([contracts.WorkspaceSchema, contracts.NewWorkspaceSchema], workspace);
addMany([contracts.CampaignSchema, contracts.NewCampaignSchema], campaign);
addMany([contracts.ObjectiveSchema, contracts.NewObjectiveSchema], objective);
addMany([contracts.PlanSchema, contracts.NewPlanSchema], plan);
addMany(
  [contracts.MotionAllocationSchema, contracts.NewMotionAllocationSchema],
  motionAllocation,
);
addMany([contracts.RunSchema, contracts.NewRunSchema], run);
addMany([contracts.TargetSchema, contracts.NewTargetSchema], target);
addMany([contracts.ContactSchema, contracts.NewContactSchema], contact);
addMany([contracts.SignalSchema, contracts.NewSignalSchema], signal);
addMany([contracts.EdgeSchema, contracts.NewEdgeSchema], edge);
addMany(
  [contracts.AssessmentSchema, contracts.NewAssessmentSchema],
  assessment,
);
addMany(
  [contracts.AllocationSchema, contracts.NewAllocationSchema],
  allocation,
);
addMany([contracts.MessageSchema, contracts.NewMessageSchema], message);
addMany(
  [contracts.InteractionSchema, contracts.NewInteractionSchema],
  interaction,
);
addMany([contracts.ToolCallSchema, contracts.NewToolCallSchema], toolCall);
addMany([contracts.PolicySchema, contracts.NewPolicySchema], policy);
addMany([contracts.ApprovalSchema, contracts.NewApprovalSchema], approval);
addMany(
  [contracts.SuppressionSchema, contracts.NewSuppressionSchema],
  suppression,
);

add(contracts.CostUnitSchema, "record");
add(contracts.UnitCostSchema, {
  unit: "record",
  operatingCents: 1,
  commitCents: 0,
  projected: true,
});
add(contracts.TargetCandidateSchema, targetCandidate);
add(contracts.GeoQueryInputSchema, {
  query: "salon",
  latitude: 12.97,
  longitude: 77.64,
  radiusKm: 5,
  limit: 10,
});
add(contracts.GeoQueryOutputSchema, { targets: [targetCandidate] });
add(contracts.GeoQueryUnitCostSchema, {
  unit: "record",
  operatingCents: 1,
  commitCents: 0,
  projected: true,
});
add(contracts.DbQueryInputSchema, {
  entityKind: "creator",
  filters: {},
  limit: 10,
});
add(contracts.DbQueryOutputSchema, { targets: [targetCandidate] });
add(contracts.DbQueryUnitCostSchema, {
  unit: "record",
  operatingCents: 1,
  commitCents: 0,
  projected: true,
});
add(contracts.WebFetchInputSchema, {
  externalRef: "business:1",
  url: "https://example.com",
});
add(contracts.WebFetchOutputSchema, webDocument);
add(contracts.WebFetchUnitCostSchema, {
  unit: "request",
  operatingCents: 1,
  commitCents: 0,
  projected: true,
});
add(contracts.ReviewsFetchInputSchema, {
  externalRef: "business:1",
  limit: 10,
});
add(contracts.ReviewArtifactSchema, review);
add(contracts.ReviewsFetchOutputSchema, {
  sourceRef: "reviews:1",
  reviews: [review],
});
add(contracts.ReviewsFetchUnitCostSchema, {
  unit: "record",
  operatingCents: 1,
  commitCents: 0,
  projected: true,
});
add(contracts.PeopleFindInputSchema, {
  externalRef: "business:1",
  channels: ["whatsapp"],
});
add(contracts.FoundPersonSchema, foundPerson);
add(contracts.PeopleFindOutputSchema, { people: [foundPerson] });
add(contracts.PeopleFindUnitCostSchema, {
  unit: "record",
  operatingCents: 1,
  commitCents: 0,
  projected: true,
});
add(contracts.SegmentBuildInputSchema, {
  name: "Wellness shoppers",
  description: "People interested in wellness",
  geography: "Bengaluru",
  criteria: { interest: "wellness" },
});
add(contracts.SegmentStatisticSchema, statisticalPayload);
add(contracts.SegmentBuildOutputSchema, {
  target: {
    kind: "segment",
    externalRef: "segment:1",
    name: "Wellness",
    payload: segmentPayload,
  },
  payload: segmentPayload,
  statistics: [statisticalPayload],
});
add(contracts.SegmentBuildUnitCostSchema, {
  unit: "request",
  operatingCents: 1,
  commitCents: 0,
  projected: true,
});
add(contracts.MessageSendInputSchema, {
  messageId: id,
  channel: "whatsapp",
  from: "+14155238886",
  to: "+919876543210",
  subject: null,
  body: "Hello",
  idempotencyKey: "message-1",
});
add(contracts.MessageSendOutputSchema, {
  providerRef: "SM1",
  status: "sent",
  acceptedAt: iso,
});
add(contracts.MessageSendUnitCostSchema, {
  unit: "message",
  operatingCents: 1,
  commitCents: 0,
  projected: false,
});
add(contracts.AdsPlanInputSchema, {
  segment: segmentPayload,
  objective: "awareness",
  commitBudgetCents: 100_000,
  durationDays: 7,
});
add(contracts.AdsPlanOutputSchema, {
  estimatedReach: 1_000,
  estimatedImpressions: 2_000,
  estimatedClicks: 50,
  commitCostCents: 100_000,
  assumptions: ["stable CPM"],
});
add(contracts.AdsPlanUnitCostSchema, {
  unit: "request",
  operatingCents: 0,
  commitCents: 1,
  projected: true,
});

add(contracts.MoneySchema, { currency: "USD", amountMinor: 100 });
add(contracts.DualBudgetSchema, budget);
add(contracts.CampaignBudgetSchema, budget);
add(contracts.CampaignSpecSchema, campaignSpec);
add(contracts.CompileObjectiveInputSchema, {
  workspaceId: id,
  campaignId: id,
  objective: "Find leads",
  budget,
});
add(contracts.CompileObjectiveOutputSchema, { ok: true, data: campaignSpec });
add(contracts.RankingWeightsSchema, rankingWeights);
add(contracts.AdapterCandidateSchema, adapterCandidate);
add(contracts.CapabilityRankingSchema, capabilityRanking);
add(contracts.AdapterChoiceSchema, adapterChoice);
add(contracts.RankedBindingSchema, rankedBinding);
add(contracts.DeclinedCapabilitySchema, {
  capabilityId: "people.find",
  reason: "Contact lookup is deferred until a target qualifies.",
});
add(contracts.DeclinedMotionSchema, declinedMotion);
add(contracts.ReplanReferenceSchema, replanReference);
add(contracts.MotionPlanSchema, motionPlan);
add(contracts.PolicyRequirementSchema, {
  kind: "approval",
  description: "Approve sends",
});
add(contracts.PlanDataSchema, planData);
add(contracts.PlanInputSchema, {
  campaignId: id,
  spec: campaignSpec,
  connectedSources: [],
});
add(contracts.PlanOutputSchema, { ok: true, data: planData });
add(contracts.DiscoverInputSchema, {
  campaignId: id,
  runId: id,
  motionId: "business.local",
  spec: campaignSpec,
});
add(contracts.DiscoverDataSchema, { targets: [targetCandidate] });
add(contracts.DiscoverOutputSchema, {
  ok: true,
  data: { targets: [targetCandidate] },
});
add(contracts.ObserveInputSchema, {
  campaignId: id,
  runId: id,
  targetId: id,
  target: targetCandidate,
});
add(contracts.SourceDocumentSchema, sourceDocument);
add(contracts.ObserveDataSchema, { documents: [sourceDocument] });
add(contracts.ObserveOutputSchema, {
  ok: true,
  data: { documents: [sourceDocument] },
});
add(contracts.ExtractedEvidenceSchema, {
  evidenceKind: "documentary",
  payload: documentaryPayload,
});
add(contracts.ExtractEvidenceInputSchema, {
  campaignId: id,
  runId: id,
  targetId: id,
  documents: [sourceDocument],
});
add(contracts.ExtractEvidenceDataSchema, {
  signals: [{ evidenceKind: "documentary", payload: documentaryPayload }],
});
add(contracts.ExtractEvidenceOutputSchema, {
  ok: true,
  data: {
    signals: [{ evidenceKind: "documentary", payload: documentaryPayload }],
  },
});
add(contracts.AssessInputSchema, {
  campaignId: id,
  runId: id,
  targetId: id,
  signals: [signal],
  rubric: ["booking"],
  droppedCount: 0,
});
add(contracts.AssessDataSchema, {
  score: 0.8,
  isFit: true,
  reason: "Strong fit",
  status: "fit",
  droppedCount: 0,
});
add(contracts.AssessOutputSchema, {
  ok: true,
  data: {
    score: 0.8,
    isFit: true,
    reason: "Strong fit",
    status: "fit",
    droppedCount: 0,
  },
});
add(contracts.FindContactInputSchema, {
  campaignId: id,
  runId: id,
  targetId: id,
  externalRef: "business:1",
  channels: ["whatsapp"],
});
add(contracts.FindContactDataSchema, {
  contact: foundPerson,
  preferredChannel: "whatsapp",
});
add(contracts.FindContactOutputSchema, {
  ok: true,
  data: { contact: foundPerson, preferredChannel: "whatsapp" },
});
add(contracts.EvidenceSentenceSchema, {
  text: "Your reviews mention booking friction.",
  evidenceId: id,
});
add(contracts.DraftInputSchema, {
  campaignId: id,
  runId: id,
  targetId: id,
  workspaceName: "MotionGrid",
  contact: foundPerson,
  channel: "whatsapp",
  signals: [signal],
});
add(contracts.DraftDataSchema, {
  channel: "whatsapp",
  subject: null,
  sentences: [
    { text: "Your reviews mention booking friction.", evidenceId: id },
  ],
});
add(contracts.DraftOutputSchema, {
  ok: true,
  data: {
    channel: "whatsapp",
    subject: null,
    sentences: [
      { text: "Your reviews mention booking friction.", evidenceId: id },
    ],
  },
});
add(contracts.PolicyGateInputSchema, {
  campaignId: id,
  targetId: id,
  channel: "whatsapp",
  relationship: "prospect",
  address: "+919876543210",
  operatingCostCents: 1,
  commitCostCents: 0,
});
add(contracts.PolicyGateDataSchema, {
  decision: "require_approval",
  reason: "External send",
});
add(contracts.PolicyGateOutputSchema, {
  ok: true,
  data: { decision: "require_approval", reason: "External send" },
});
add(contracts.SynthesizeInputSchema, {
  campaignId: id,
  runId: id,
  targetIds: [id],
});
add(contracts.DiscoveredEdgeSchema, {
  fromTargetId: id,
  toTargetId: id2,
  kind: "mentions",
  evidenceId: id,
  confidence: 0.8,
});
const synthesis = {
  edges: [
    {
      fromTargetId: id,
      toTargetId: id2,
      kind: "mentions",
      evidenceId: id,
      confidence: 0.8,
    },
  ],
  outcome: {
    targetCount: 1,
    fitCount: 1,
    sentCount: 0,
    engagedCount: 0,
    operatingSpentCents: 1,
    commitSpentCents: 0,
  },
};
add(contracts.SynthesizeDataSchema, synthesis);
add(contracts.SynthesizeOutputSchema, { ok: true, data: synthesis });
add(contracts.ReplyIntentSchema, "interested");
add(contracts.SentimentSchema, "positive");
add(contracts.NextActionSchema, "reply");
add(contracts.ClassifyReplyInputSchema, {
  campaignId: id,
  targetId: id,
  messageId: id,
  channel: "whatsapp",
  text: "Interested",
});
const classification = {
  intent: "interested",
  sentiment: "positive",
  nextAction: "reply",
  confidence: 0.9,
};
add(contracts.ClassifyReplyDataSchema, classification);
add(contracts.ClassifyReplyOutputSchema, { ok: true, data: classification });
add(contracts.TargetStateTransitionSchema, {
  targetId: id,
  from: "discovered",
  to: "observed",
});

add(contracts.ApiErrorSchema, {
  error: { code: "not_found", message: "Not found" },
});
add(contracts.CreateCampaignRequestSchema, {
  workspaceId: id,
  name: "Launch",
  objective: "Find leads",
  budget,
});
add(contracts.CreateCampaignResponseSchema, { campaign, objective });
add(contracts.ListCampaignsRequestSchema, { workspaceId: id });
const summary = {
  id,
  name: "Launch",
  status: "draft",
  motions: ["business.local"],
  operatingBudgetCents: 5_000,
  operatingSpentCents: 0,
  commitBudgetCents: 15_000_000,
  commitSpentCents: 0,
  replyCount: 0,
  createdAt: now,
};
add(contracts.CampaignSummarySchema, summary);
add(contracts.ListCampaignsResponseSchema, { campaigns: [summary] });
add(contracts.CampaignDetailRequestSchema, { campaignId: id });
add(contracts.CampaignDetailResponseSchema, {
  campaign,
  objective,
  plan,
  targets: [target],
});
add(contracts.ApproveCampaignRequestSchema, {
  campaignId: id,
  approvalId: id,
  approved: true,
  decidedBy: "operator",
});
add(contracts.ApproveCampaignResponseSchema, {
  approval,
  campaignStatus: "approved",
});
add(contracts.StartRunRequestSchema, { campaignId: id, kind: "discovery" });
add(contracts.StartRunResponseSchema, { run });
add(contracts.ApproveMessageRequestSchema, {
  messageId: id,
  approved: true,
  decidedBy: "operator",
});
add(contracts.ApproveMessageResponseSchema, { message, approval });
add(contracts.StreamRequestSchema, { runId: id });
add(contracts.TwilioWebhookRequestSchema, {
  MessageSid: "SM1",
  From: "+919876543210",
  To: "+14155238886",
  Body: "Interested",
});
add(contracts.ResendWebhookRequestSchema, {
  type: "email.delivered",
  created_at: iso,
  data: { email_id: "email-1", to: ["owner@example.com"] },
});
add(contracts.WebhookResponseSchema, { received: true });
const planDelta = {
  ...eventBase,
  type: "plan.delta",
  data: { sequence: 1, delta: "motion", snapshot: planData },
};
const targetState = {
  ...eventBase,
  type: "target.state",
  data: { targetId: id, from: "discovered", to: "observed", reason: null },
};
const motionSelected = {
  ...eventBase,
  type: "motion_selected",
  data: {
    motionId: "business.local",
    rationale: "The objective requires local business discovery.",
  },
};
const motionDeclined = {
  ...eventBase,
  type: "motion_declined",
  data: declinedMotion,
};
const capabilityRanked = {
  ...eventBase,
  type: "capability_ranked",
  data: capabilityRanking,
};
const bindingChosen = {
  ...eventBase,
  type: "binding_chosen",
  data: { capabilityId: "geo.query", chosen: adapterChoice },
};
const policyWarning = {
  ...eventBase,
  type: "policy_warning",
  data: {
    warning: {
      kind: "budget_threshold",
      utilizationBasisPoints: 8_000,
    },
    reason:
      "Operating budget has reached at least 80%; continue with a budget warning.",
  },
};
const replanStarted = {
  ...eventBase,
  type: "replan_started",
  data: replanReference,
};
const costTick = {
  ...eventBase,
  type: "cost.tick",
  data: {
    capabilityId: "geo.query",
    operatingDeltaCents: 1,
    operatingTotalCents: 1,
    commitDeltaCents: 0,
    commitTotalCents: 0,
    projected: true,
  },
};
const signalAdded = { ...eventBase, type: "signal.added", data: { signal } };
const assessmentRecorded = {
  ...eventBase,
  type: "assessment.recorded",
  data: {
    targetId: id,
    score: 0.8,
    isFit: true,
    reason: "Verified evidence meets the rubric.",
    droppedCount: 1,
  },
};
const edgeDiscovered = {
  ...eventBase,
  type: "edge.discovered",
  data: { edge },
};
const approvalRequired = {
  ...eventBase,
  type: "approval.required",
  data: { approval },
};
const messageSent = { ...eventBase, type: "message.sent", data: { message } };
const interactionReceived = {
  ...eventBase,
  type: "interaction.received",
  data: { interaction, channel: "whatsapp", kind: "reply" },
};
const runDone = {
  ...eventBase,
  type: "run.done",
  data: {
    run,
    targetCounts: {
      discovered: 0,
      observed: 0,
      scored: 0,
      not_fit: 0,
      fit: 0,
      contact_found: 0,
      draft_ready: 1,
      pending_approval: 0,
      sent: 0,
      delivered: 0,
      engaged: 0,
      suppressed: 0,
    },
  },
};
add(contracts.PlanDeltaEventSchema, planDelta);
add(contracts.MotionSelectedEventSchema, motionSelected);
add(contracts.MotionDeclinedEventSchema, motionDeclined);
add(contracts.CapabilityRankedEventSchema, capabilityRanked);
add(contracts.BindingChosenEventSchema, bindingChosen);
add(contracts.PolicyWarningEventSchema, policyWarning);
add(contracts.ReplanStartedEventSchema, replanStarted);
add(contracts.TargetStateEventSchema, targetState);
add(contracts.CostTickEventSchema, costTick);
add(contracts.SignalAddedEventSchema, signalAdded);
add(contracts.AssessmentRecordedEventSchema, assessmentRecorded);
add(contracts.EdgeDiscoveredEventSchema, edgeDiscovered);
add(contracts.ApprovalRequiredEventSchema, approvalRequired);
add(contracts.MessageSentEventSchema, messageSent);
add(contracts.InteractionReceivedEventSchema, interactionReceived);
add(contracts.RunDoneEventSchema, runDone);
add(contracts.SseEventSchema, capabilityRanked);

for (const [name, exported] of Object.entries(contracts)) {
  if (exported instanceof z.ZodType) {
    const example = cases.get(exported);
    if (example === undefined)
      throw new Error(`Missing smoke example for ${name}`);
    exported.parse(example);
  }
}

console.log(`Parsed ${cases.size} exported contract schemas.`);
