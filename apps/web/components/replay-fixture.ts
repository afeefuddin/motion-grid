import { CampaignDetailResponseSchema, SseEventSchema } from "../../../src/contracts/api";
import { PlanDataSchema } from "../../../src/contracts/steps";

const campaignId = "10000000-0000-4000-8000-000000000002";
const runId = campaignId;
const planId = "20000000-0000-4000-8000-000000000001";
const approvalId = "30000000-0000-4000-8000-000000000001";
const messageId = "30000000-0000-4000-8000-000000000002";
const signalId = "40000000-0000-4000-8000-000000000001";
const targetOne = "50000000-0000-4000-8000-000000000001";
const targetTwo = "50000000-0000-4000-8000-000000000002";
const targetThree = "50000000-0000-4000-8000-000000000003";
const targetCreator = "50000000-0000-4000-8000-000000000004";
const now = new Date("2026-08-08T10:00:00.000Z");

const geoRanking = {
  capabilityId: "geo.query",
  weights: { cost: 0.2, freshness: 0.25, confidence: 0.35, coverage: 0.2 },
  weightsRationale: "Confidence and freshness lead because local availability changes quickly; cost remains bounded by the operating budget.",
  candidates: [
    { adapterId: "market.geo", mode: "sim", dimensionScores: { cost: 1, freshness: 0.72, confidence: 0.76, coverage: 0.94 }, totalScore: 0.823, eligible: true, reason: "Best eligible score with complete Bengaluru coverage." },
    { adapterId: "generated.market", mode: "generated", dimensionScores: { cost: 0.9, freshness: 0.62, confidence: 0.62, coverage: 1 }, totalScore: 0.752, eligible: true, reason: "Useful fallback with synthetic 30-day freshness." },
    { adapterId: "outscraper", mode: "live", dimensionScores: { cost: 0.38, freshness: 0.95, confidence: 0.91, coverage: 0.96 }, totalScore: 0.824, eligible: false, reason: "Projected spend crosses the approved operating threshold." },
  ],
};

export const replayPlan = PlanDataSchema.parse({
  campaignId,
  motions: [
    { motionId: "business.local", capabilities: ["geo.query", "web.fetch", "reviews.fetch", "people.find", "message.send"], operatingBudgetCents: 3500, commitBudgetCents: 0, dependsOn: [], rationale: "Local businesses with visible booking friction can be verified and reached directly.", bindings: [{ ...geoRanking, chosen: { adapterId: "market.geo", mode: "sim" } }], declined: [] },
    { motionId: "creator", capabilities: ["db.query", "message.send"], operatingBudgetCents: 1500, commitBudgetCents: 25000000, dependsOn: ["business.local"], rationale: "Known creator relationships can open a warmer path to the strongest local targets.", bindings: [{ capabilityId: "db.query", weights: { cost: 0.15, freshness: 0.2, confidence: 0.4, coverage: 0.25 }, weightsRationale: "Relationship confidence matters most for a warm introduction.", candidates: [{ adapterId: "index.db", mode: "sim", dimensionScores: { cost: 1, freshness: 0.84, confidence: 0.94, coverage: 0.86 }, totalScore: 0.908, eligible: true, reason: "Seeded relationship index is deterministic and verified." }], chosen: { adapterId: "index.db", mode: "sim" } }], declined: [] },
  ],
  policies: [
    { kind: "operating_budget_cap", description: "Every capability cost is checked before execution." },
    { kind: "require_approval", description: "Outbound messages and creator rosters require human approval." },
    { kind: "consent_policy", description: "Each motion must satisfy its declared consent basis before outreach." },
  ],
  suggestedActions: [
    { kind: "person_to_person", title: "Ask for trusted introductions", description: "Have customers or creators personally introduce the team to the highest-fit salons.", rationale: "A warm introduction can reach the decision-maker without more automated-message volume.", motionIds: ["business.local", "creator"] },
    { kind: "print_materials", title: "Test trackable flyers in Indiranagar", description: "Place a concise flyer with a campaign-specific QR code at complementary neighborhood businesses.", rationale: "A unique QR destination makes offline reach measurable.", motionIds: ["business.local"] },
    { kind: "door_to_door", title: "Run a focused door-to-door route", description: "Visit a compact cluster of qualified salons with a short demo and record consent before follow-up.", rationale: "An in-person visit can validate booking friction and identify the owner or manager.", motionIds: ["business.local"] },
  ],
  budget: { operating: { currency: "USD", amountMinor: 5000 }, commit: { currency: "INR", amountMinor: 25000000 } },
  declinedMotions: [{ motionId: "consumer.ads", reason: "The objective provides no consented audience or conversion history to justify paid acquisition." }, { motionId: "business.online", reason: "The geography and booking-friction signal favor a local discovery motion." }],
  replanOf: null,
});

export const replayCampaign = CampaignDetailResponseSchema.parse({
  campaign: { id: campaignId, workspaceId: "10000000-0000-4000-8000-000000000001", name: "Bengaluru local-service growth", status: "completed", operatingBudgetCents: 5000, operatingSpentCents: 642, commitBudgetCents: 25000000, commitSpentCents: 15000000, outcome: null, createdAt: now, updatedAt: now },
  objective: { id: "10000000-0000-4000-8000-000000000003", campaignId, prompt: "Find Bengaluru salons without reliable online booking, qualify them, and create a creator-assisted demo pipeline.", compiledSpec: { status: "compiled" }, createdAt: now, updatedAt: now },
  plan: { id: planId, campaignId, version: 1, status: "approved", spec: replayPlan, createdAt: now, updatedAt: now },
  targets: [
    { id: targetOne, campaignId, motionId: "business.local", kind: "organization", relationship: "prospect", status: "fit", externalRef: "aarohi-salon", name: "Aarohi Salon & Spa", payload: { address: "12th Main, Indiranagar", locality: "Indiranagar", categories: ["Salon", "Spa"], websiteUrl: "https://example.com/aarohi", phone: "+919900000001" }, createdAt: now, updatedAt: now },
    { id: targetTwo, campaignId, motionId: "business.local", kind: "organization", relationship: "prospect", status: "not_fit", externalRef: "studio-serein", name: "Studio Serein", payload: { address: "100 Feet Road, Indiranagar", locality: "Indiranagar", categories: ["Salon"], websiteUrl: "https://example.com/serein", phone: "+919900000002" }, createdAt: now, updatedAt: now },
    { id: targetThree, campaignId, motionId: "business.local", kind: "organization", relationship: "prospect", status: "pending_approval", externalRef: "tvacha-clinic", name: "Tvacha Skin Clinic", payload: { address: "CMH Road, Indiranagar", locality: "Indiranagar", categories: ["Skin clinic"], websiteUrl: "https://example.com/tvacha", phone: "+919900000003" }, createdAt: now, updatedAt: now },
    { id: targetCreator, campaignId, motionId: "creator", kind: "person", relationship: "prospect_partner", status: "fit", externalRef: "creator-03", name: "Maya Rao", payload: { platform: "Instagram", handle: "@mayamakes", followerCount: 48200, rateCardCommitCents: 15000000 }, createdAt: now, updatedAt: now },
  ],
  allocations: [],
  conversation: [
    { id: "70000000-0000-4000-8000-000000000001", campaignId, runId, role: "operator", status: "sent", content: "Find Bengaluru salons without reliable online booking, qualify them, and create a creator-assisted demo pipeline.", createdAt: now, updatedAt: now },
    { id: "70000000-0000-4000-8000-000000000002", campaignId, runId, role: "motiongrid", status: "completed", content: "I built the first campaign route. You can ask me to change the audience, motion mix, budget, evidence bar, or outreach constraints.", createdAt: now, updatedAt: now },
  ],
  approvals: [{ id: approvalId, campaignId, runId, messageId, decision: "require_approval", status: "pending", reason: "Evidence-backed outreach is ready for the selected contact.", requestedAt: now, decidedAt: null, decidedBy: null, createdAt: now, updatedAt: now }],
});

export const replayEvents = [
  SseEventSchema.parse({ id: "evt-0", runId, campaignId, occurredAt: "2026-08-08T10:00:00.500Z", type: "agent.status", data: { agentId: "planner", label: "Campaign planner", status: "running", detail: "Ranking motions, providers, policy gates, and budget allocation." } }),
  SseEventSchema.parse({ id: "evt-1", runId, campaignId, occurredAt: "2026-08-08T10:00:01.000Z", type: "plan.delta", data: { sequence: 1, delta: "Plan assembled", snapshot: replayPlan } }),
  SseEventSchema.parse({ id: "evt-2", runId, campaignId, occurredAt: "2026-08-08T10:00:02.000Z", type: "motion_selected", data: { motionId: "business.local", rationale: "Booking friction is locally observable." } }),
  SseEventSchema.parse({ id: "evt-3", runId, campaignId, occurredAt: "2026-08-08T10:00:03.000Z", type: "motion_declined", data: { motionId: "consumer.ads", reason: "No consented audience or conversion history." } }),
  SseEventSchema.parse({ id: "evt-4", runId, campaignId, occurredAt: "2026-08-08T10:00:04.000Z", type: "capability_ranked", data: geoRanking }),
  SseEventSchema.parse({ id: "evt-5", runId, campaignId, occurredAt: "2026-08-08T10:00:05.000Z", type: "target.state", data: { targetId: targetOne, from: "scored", to: "fit", reason: "Phone-only booking and repeated wait complaints verified." } }),
  SseEventSchema.parse({ id: "evt-6", runId, campaignId, occurredAt: "2026-08-08T10:00:06.000Z", type: "signal.added", data: { signal: { id: signalId, campaignId, targetId: targetOne, runId, evidenceKind: "documentary", payload: { sourceRef: "https://aarohisalon.example/book", excerpt: "Call us to reserve your appointment.", verified: true, implication: "The business still relies on a manual booking path.", strength: 0.92 }, createdAt: now, updatedAt: now } } }),
  SseEventSchema.parse({ id: "evt-6-assessment", runId, campaignId, occurredAt: "2026-08-08T10:00:06.500Z", type: "assessment.recorded", data: { targetId: targetOne, score: 0.82, isFit: true, reason: "Verified evidence meets the local-service rubric.", droppedCount: 1 } }),
  SseEventSchema.parse({ id: "evt-7", runId, campaignId, occurredAt: "2026-08-08T10:00:07.000Z", type: "edge.discovered", data: { edge: { id: "60000000-0000-4000-8000-000000000001", campaignId, fromTargetId: targetCreator, toTargetId: targetOne, kind: "mentions", evidenceId: signalId, confidence: 0.91, createdAt: now, updatedAt: now } } }),
  SseEventSchema.parse({ id: "evt-8", runId, campaignId, occurredAt: "2026-08-08T10:00:08.000Z", type: "cost.tick", data: { capabilityId: "web.fetch", operatingDeltaCents: 42, operatingTotalCents: 642, commitDeltaCents: 0, commitTotalCents: 15000000, projected: false } }),
  SseEventSchema.parse({ id: "evt-9", runId, campaignId, occurredAt: "2026-08-08T10:00:09.000Z", type: "replan_started", data: { planId, trigger: "budget_denied", reason: "Outscraper would cross the operating-budget threshold; switching discovery to market.geo." } }),
  SseEventSchema.parse({ id: "evt-10", runId, campaignId, occurredAt: "2026-08-08T10:00:10.000Z", type: "policy_warning", data: { warning: { kind: "budget_threshold", utilizationBasisPoints: 8200 }, reason: "Projected operating spend reached 82% of budget." } }),
  SseEventSchema.parse({ id: "evt-11", runId, campaignId, occurredAt: "2026-08-08T10:00:11.000Z", type: "approval.required", data: { approval: { id: approvalId, campaignId, runId, messageId, decision: "require_approval", status: "pending", reason: "Evidence-backed outreach is ready for the selected contact.", requestedAt: now, decidedAt: null, decidedBy: null, createdAt: now, updatedAt: now } } }),
];
