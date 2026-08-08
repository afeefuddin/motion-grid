import { z } from "zod";

export const NonnegativeCentsSchema = z.int().nonnegative();
export const ConfidenceSchema = z.number().min(0).max(1);
export const JsonValueSchema = z.json();

export const OrganizationTargetPayloadSchema = z.object({
  address: z.string().min(1),
  locality: z.string().min(1),
  categories: z.array(z.string().min(1)),
  websiteUrl: z.url().nullable(),
  phone: z.string().min(1).nullable(),
});

export const PersonTargetPayloadSchema = z.object({
  platform: z.string().min(1),
  handle: z.string().min(1),
  followerCount: z.int().nonnegative(),
  rateCardCommitCents: NonnegativeCentsSchema.nullable(),
});

export const SegmentTargetPayloadSchema = z.object({
  description: z.string().min(1),
  estimatedSize: z.int().nonnegative(),
  criteria: z.record(z.string(), JsonValueSchema),
});

export const TargetPayloadSchema = z.union([
  OrganizationTargetPayloadSchema,
  PersonTargetPayloadSchema,
  SegmentTargetPayloadSchema,
]);

export const DocumentaryEvidencePayloadSchema = z.object({
  sourceRef: z.string().min(1),
  excerpt: z.string().min(1),
  verified: z.boolean(),
  implication: z.string().min(1),
  strength: ConfidenceSchema,
});

export const StatisticalEvidencePayloadSchema = z.object({
  metric: z.string().min(1),
  value: z.number(),
  baseline: z.number(),
  method: z.string().min(1),
  window: z.string().min(1),
  implication: z.string().min(1),
  strength: ConfidenceSchema,
});

export const EvidencePayloadSchema = z.union([
  DocumentaryEvidencePayloadSchema,
  StatisticalEvidencePayloadSchema,
]);

export type TargetPayload = z.infer<typeof TargetPayloadSchema>;
export type EvidencePayload = z.infer<typeof EvidencePayloadSchema>;
