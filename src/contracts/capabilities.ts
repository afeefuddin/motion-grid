import { z } from "zod";
import { ChannelSchema, capabilityIds, defineValues } from "./enums";
import {
  ConfidenceSchema,
  NonnegativeCentsSchema,
  OrganizationTargetPayloadSchema,
  PersonTargetPayloadSchema,
  SegmentTargetPayloadSchema,
} from "./payloads";

export const costUnits = defineValues(
  "request",
  "record",
  "message",
  "impression",
);
export const CostUnitSchema = z.enum(costUnits);

export const UnitCostSchema = z.object({
  unit: CostUnitSchema,
  operatingCents: z.number().nonnegative(),
  commitCents: z.number().nonnegative(),
  projected: z.boolean(),
});

export const TargetCandidateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("organization"),
    externalRef: z.string().min(1),
    name: z.string().min(1),
    payload: OrganizationTargetPayloadSchema,
  }),
  z.object({
    kind: z.literal("person"),
    externalRef: z.string().min(1),
    name: z.string().min(1),
    payload: PersonTargetPayloadSchema,
  }),
  z.object({
    kind: z.literal("segment"),
    externalRef: z.string().min(1),
    name: z.string().min(1),
    payload: SegmentTargetPayloadSchema,
  }),
]);

export const GeoQueryInputSchema = z.object({
  query: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().positive(),
  limit: z.int().positive().max(100),
});
export const GeoQueryOutputSchema = z.object({
  targets: z.array(TargetCandidateSchema),
});
export const GeoQueryUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("record"),
});

export const DbQueryInputSchema = z.object({
  entityKind: z.enum(["creator", "company"]),
  filters: z.object({
    category: z.string().min(1).optional(),
    locality: z.string().min(1).optional(),
    minimumFollowers: z.int().nonnegative().optional(),
    maximumCommitCents: NonnegativeCentsSchema.optional(),
  }),
  limit: z.int().positive().max(100),
});
export const DbQueryOutputSchema = z.object({
  targets: z.array(TargetCandidateSchema),
});
export const DbQueryUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("record"),
});

export const WebFetchInputSchema = z.object({
  externalRef: z.string().min(1),
  url: z.url(),
});
export const WebFetchOutputSchema = z.object({
  sourceRef: z.string().min(1),
  url: z.url(),
  contentType: z.string().min(1),
  content: z.string(),
  fetchedAt: z.iso.datetime(),
});
export const WebFetchUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("request"),
});

export const ReviewsFetchInputSchema = z.object({
  externalRef: z.string().min(1),
  limit: z.int().positive().max(100),
});
export const ReviewArtifactSchema = z.object({
  id: z.string().min(1),
  rating: z.number().min(1).max(5),
  text: z.string().min(1),
  occurredAt: z.iso.datetime(),
});
export const ReviewsFetchOutputSchema = z.object({
  sourceRef: z.string().min(1),
  reviews: z.array(ReviewArtifactSchema),
});
export const ReviewsFetchUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("record"),
});

export const PeopleFindInputSchema = z.object({
  externalRef: z.string().min(1),
  channels: z.array(ChannelSchema).min(1),
});
export const FoundPersonSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.email().nullable(),
  phone: z.string().min(1).nullable(),
  confidence: ConfidenceSchema,
});
export const PeopleFindOutputSchema = z.object({
  people: z.array(FoundPersonSchema),
});
export const PeopleFindUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("record"),
});

export const SegmentBuildInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  geography: z.string().min(1),
  criteria: z.record(z.string(), z.json()),
});
export const SegmentStatisticSchema = z.object({
  metric: z.string().min(1),
  value: z.number(),
  baseline: z.number(),
  method: z.string().min(1),
  window: z.string().min(1),
});
export const SegmentBuildOutputSchema = z.object({
  target: TargetCandidateSchema,
  payload: SegmentTargetPayloadSchema,
  statistics: z.array(SegmentStatisticSchema),
});
export const SegmentBuildUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("request"),
});

export const MessageSendInputSchema = z.object({
  messageId: z.uuid(),
  channel: ChannelSchema,
  from: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().min(1).nullable(),
  body: z.string().min(1),
  idempotencyKey: z.string().min(1),
});
export const MessageSendOutputSchema = z.object({
  providerRef: z.string().min(1),
  status: z.enum(["accepted", "sent"]),
  acceptedAt: z.iso.datetime(),
});
export const MessageSendUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("message"),
});

export const AdsPlanInputSchema = z.object({
  segment: SegmentTargetPayloadSchema,
  objective: z.string().min(1),
  commitBudgetCents: NonnegativeCentsSchema,
  durationDays: z.int().positive(),
});
export const AdsPlanOutputSchema = z.object({
  estimatedReach: z.int().nonnegative(),
  estimatedImpressions: z.int().nonnegative(),
  estimatedClicks: z.int().nonnegative(),
  commitCostCents: NonnegativeCentsSchema,
  assumptions: z.array(z.string().min(1)),
});
export const AdsPlanUnitCostSchema = UnitCostSchema.extend({
  unit: z.literal("impression"),
});

export const capabilityContracts = {
  [capabilityIds[0]]: {
    input: GeoQueryInputSchema,
    output: GeoQueryOutputSchema,
    unitCost: GeoQueryUnitCostSchema,
  },
  [capabilityIds[1]]: {
    input: DbQueryInputSchema,
    output: DbQueryOutputSchema,
    unitCost: DbQueryUnitCostSchema,
  },
  [capabilityIds[2]]: {
    input: WebFetchInputSchema,
    output: WebFetchOutputSchema,
    unitCost: WebFetchUnitCostSchema,
  },
  [capabilityIds[3]]: {
    input: ReviewsFetchInputSchema,
    output: ReviewsFetchOutputSchema,
    unitCost: ReviewsFetchUnitCostSchema,
  },
  [capabilityIds[4]]: {
    input: PeopleFindInputSchema,
    output: PeopleFindOutputSchema,
    unitCost: PeopleFindUnitCostSchema,
  },
  [capabilityIds[5]]: {
    input: SegmentBuildInputSchema,
    output: SegmentBuildOutputSchema,
    unitCost: SegmentBuildUnitCostSchema,
  },
  [capabilityIds[6]]: {
    input: MessageSendInputSchema,
    output: MessageSendOutputSchema,
    unitCost: MessageSendUnitCostSchema,
  },
  [capabilityIds[7]]: {
    input: AdsPlanInputSchema,
    output: AdsPlanOutputSchema,
    unitCost: AdsPlanUnitCostSchema,
  },
};

export type CapabilityId = keyof typeof capabilityContracts;
