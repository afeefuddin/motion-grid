import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { z } from "zod";
import {
  approvalStatuses,
  campaignStatuses,
  channels,
  edgeKinds,
  evidenceKinds,
  interactionKinds,
  messageStatuses,
  motionIds,
  policyDecisions,
  runKinds,
  runStatuses,
  suppressionScopes,
  targetKinds,
  targetRelationships,
  targetStatuses,
  type WorkspaceSourceSchema,
} from "../contracts/enums";
import type { EvidencePayload, TargetPayload } from "../contracts/payloads";

export const campaignStatusEnum = pgEnum("campaign_status", campaignStatuses);
export const targetKindEnum = pgEnum("target_kind", targetKinds);
export const targetRelationshipEnum = pgEnum(
  "target_relationship",
  targetRelationships,
);
export const targetStatusEnum = pgEnum("target_status", targetStatuses);
export const runKindEnum = pgEnum("run_kind", runKinds);
export const runStatusEnum = pgEnum("run_status", runStatuses);
export const channelEnum = pgEnum("channel", channels);
export const evidenceKindEnum = pgEnum("evidence_kind", evidenceKinds);
export const edgeKindEnum = pgEnum("edge_kind", edgeKinds);
export const policyDecisionEnum = pgEnum("policy_decision", policyDecisions);
export const approvalStatusEnum = pgEnum("approval_status", approvalStatuses);
export const messageStatusEnum = pgEnum("message_status", messageStatuses);
export const interactionKindEnum = pgEnum("interaction_kind", interactionKinds);
export const suppressionScopeEnum = pgEnum(
  "suppression_scope",
  suppressionScopes,
);
export const motionIdEnum = pgEnum("motion_id", motionIds);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  connectedSources: jsonb("connected_sources")
    .$type<z.output<typeof WorkspaceSourceSchema>[]>()
    .default([])
    .notNull(),
  ...timestamps,
});

export const campaign = pgTable(
  "campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: campaignStatusEnum("status").default("draft").notNull(),
    operatingBudgetCents: integer("operating_budget_cents").notNull(),
    operatingSpentCents: integer("operating_spent_cents").default(0).notNull(),
    commitBudgetCents: integer("commit_budget_cents").notNull(),
    commitSpentCents: integer("commit_spent_cents").default(0).notNull(),
    outcome: jsonb("outcome"),
    ...timestamps,
  },
  (table) => [
    check(
      "campaign_operating_budget_nonnegative",
      sql`${table.operatingBudgetCents} >= 0`,
    ),
    check(
      "campaign_operating_spent_nonnegative",
      sql`${table.operatingSpentCents} >= 0`,
    ),
    check(
      "campaign_commit_budget_nonnegative",
      sql`${table.commitBudgetCents} >= 0`,
    ),
    check(
      "campaign_commit_spent_nonnegative",
      sql`${table.commitSpentCents} >= 0`,
    ),
  ],
);

export const objective = pgTable("objective", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaign.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  compiledSpec: jsonb("compiled_spec").notNull(),
  ...timestamps,
});

export const campaignConversationMessage = pgTable(
  "campaign_conversation_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    runId: uuid("run_id"),
    role: text("role").notNull(),
    status: text("status").notNull(),
    content: text("content").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "campaign_conversation_message_role_valid",
      sql`${table.role} in ('operator', 'motiongrid')`,
    ),
    check(
      "campaign_conversation_message_status_valid",
      sql`${table.status} in ('sent', 'running', 'completed', 'failed')`,
    ),
  ],
);

export const plan = pgTable(
  "plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").default("draft").notNull(),
    spec: jsonb("spec").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("plan_campaign_version_unique").on(
      table.campaignId,
      table.version,
    ),
    check("plan_version_positive", sql`${table.version} > 0`),
  ],
);

export const motionAllocation = pgTable(
  "motion_allocation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    motionId: motionIdEnum("motion_id").notNull(),
    operatingBudgetCents: integer("operating_budget_cents").notNull(),
    commitBudgetCents: integer("commit_budget_cents").notNull(),
    dependsOn: jsonb("depends_on").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("motion_allocation_plan_motion_unique").on(
      table.planId,
      table.motionId,
    ),
    check(
      "motion_allocation_operating_nonnegative",
      sql`${table.operatingBudgetCents} >= 0`,
    ),
    check(
      "motion_allocation_commit_nonnegative",
      sql`${table.commitBudgetCents} >= 0`,
    ),
  ],
);

export const run = pgTable("run", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaign.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").references(() => plan.id, { onDelete: "set null" }),
  kind: runKindEnum("kind").notNull(),
  status: runStatusEnum("status").default("pending").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  ...timestamps,
});

export const target = pgTable(
  "target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    motionId: motionIdEnum("motion_id").default("business.local").notNull(),
    kind: targetKindEnum("kind").notNull(),
    relationship: targetRelationshipEnum("relationship").notNull(),
    status: targetStatusEnum("status").default("discovered").notNull(),
    externalRef: text("external_ref").notNull(),
    name: text("name").notNull(),
    payload: jsonb("payload").$type<TargetPayload>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("target_campaign_natural_key_unique").on(
      table.campaignId,
      table.kind,
      table.externalRef,
    ),
  ],
);

export const contact = pgTable(
  "contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => target.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    address: text("address").notNull(),
    displayName: text("display_name"),
    consentBasis: text("consent_basis").notNull(),
    verified: boolean("verified").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contact_target_channel_address_unique").on(
      table.targetId,
      table.channel,
      table.address,
    ),
  ],
);

export const signal = pgTable("signal", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaign.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => target.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => run.id, { onDelete: "set null" }),
  evidenceKind: evidenceKindEnum("evidence_kind").notNull(),
  payload: jsonb("payload").$type<EvidencePayload>().notNull(),
  ...timestamps,
});

export const edge = pgTable(
  "edge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    fromTargetId: uuid("from_target")
      .notNull()
      .references(() => target.id, { onDelete: "cascade" }),
    toTargetId: uuid("to_target")
      .notNull()
      .references(() => target.id, { onDelete: "cascade" }),
    kind: edgeKindEnum("kind").notNull(),
    evidenceId: uuid("evidence_id").references(() => signal.id, {
      onDelete: "set null",
    }),
    confidence: real("confidence").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("edge_campaign_nodes_kind_unique").on(
      table.campaignId,
      table.fromTargetId,
      table.toTargetId,
      table.kind,
    ),
    check(
      "edge_confidence_range",
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 1`,
    ),
    check(
      "edge_distinct_targets",
      sql`${table.fromTargetId} <> ${table.toTargetId}`,
    ),
  ],
);

export const assessment = pgTable(
  "assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => target.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    isFit: boolean("is_fit").notNull(),
    reason: text("reason").notNull(),
    droppedCount: integer("dropped_count").default(0).notNull(),
    rubric: jsonb("rubric").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "assessment_score_range",
      sql`${table.score} >= 0 AND ${table.score} <= 1`,
    ),
    check(
      "assessment_dropped_count_nonnegative",
      sql`${table.droppedCount} >= 0`,
    ),
  ],
);

export const allocation = pgTable(
  "allocation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => target.id, { onDelete: "cascade" }),
    motionId: motionIdEnum("motion_id").notNull(),
    commitCents: integer("commit_cents").notNull(),
    selected: boolean("selected").notNull(),
    reason: text("reason").notNull(),
    ...timestamps,
  },
  (table) => [
    check("allocation_commit_nonnegative", sql`${table.commitCents} >= 0`),
  ],
);

export const message = pgTable("message", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaign.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => target.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contact.id, { onDelete: "restrict" }),
  runId: uuid("run_id")
    .notNull()
    .references(() => run.id, { onDelete: "cascade" }),
  channel: channelEnum("channel").notNull(),
  status: messageStatusEnum("status").default("draft").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  evidenceIds: jsonb("evidence_ids").notNull(),
  providerRef: text("provider_ref"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
});

export const interaction = pgTable("interaction", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaign.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => target.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => message.id, {
    onDelete: "set null",
  }),
  channel: channelEnum("channel").notNull(),
  kind: interactionKindEnum("kind").notNull(),
  providerRef: text("provider_ref"),
  body: text("body"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  payload: jsonb("payload"),
  ...timestamps,
});

export const toolCall = pgTable(
  "tool_call",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => run.id, { onDelete: "cascade" }),
    targetId: uuid("target_id").references(() => target.id, {
      onDelete: "set null",
    }),
    capabilityId: text("capability_id").notNull(),
    adapterId: text("adapter_id").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output").notNull(),
    operatingCostCents: integer("operating_cost_cents").notNull(),
    projected: boolean("projected").default(false).notNull(),
    durationMs: integer("duration_ms").notNull(),
    ...timestamps,
  },
  (table) => [
    check("tool_call_cost_nonnegative", sql`${table.operatingCostCents} >= 0`),
    check("tool_call_duration_nonnegative", sql`${table.durationMs} >= 0`),
  ],
);

export const policy = pgTable("policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaign.id, {
    onDelete: "cascade",
  }),
  kind: text("kind").notNull(),
  config: jsonb("config").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  ...timestamps,
});

export const approval = pgTable("approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaign.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => run.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => message.id, {
    onDelete: "cascade",
  }),
  decision: policyDecisionEnum("decision").notNull(),
  status: approvalStatusEnum("status").default("pending").notNull(),
  reason: text("reason").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by"),
  ...timestamps,
});

export const suppression = pgTable(
  "suppression",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaign.id, {
      onDelete: "cascade",
    }),
    scope: suppressionScopeEnum("scope").notNull(),
    channel: channelEnum("channel").notNull(),
    address: text("address").notNull(),
    reason: text("reason").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("suppression_scope_address_unique").on(
      table.workspaceId,
      table.campaignId,
      table.channel,
      table.address,
    ),
  ],
);
