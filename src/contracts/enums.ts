import { z } from "zod";

export const defineValues = <const T extends readonly [string, ...string[]]>(
  ...values: T
) => values;

export const motionIds = defineValues(
  "creator",
  "business.local",
  "business.online",
  "consumer.ads",
  "consumer.email",
);
export const MotionIdSchema = z.enum(motionIds);

export const targetKinds = defineValues("organization", "person", "segment");
export const TargetKindSchema = z.enum(targetKinds);

export const targetRelationships = defineValues(
  "prospect",
  "prospect_partner",
  "customer",
);
export const TargetRelationshipSchema = z.enum(targetRelationships);

export const campaignStatuses = defineValues(
  "draft",
  "planning",
  "pending_approval",
  "approved",
  "running",
  "paused",
  "completed",
  "failed",
);
export const CampaignStatusSchema = z.enum(campaignStatuses);

export const targetStatuses = defineValues(
  "discovered",
  "observed",
  "scored",
  "not_fit",
  "fit",
  "contact_found",
  "draft_ready",
  "pending_approval",
  "sent",
  "delivered",
  "engaged",
  "suppressed",
);
export const TargetStatusSchema = z.enum(targetStatuses);

export const runKinds = defineValues(
  "discovery",
  "outreach",
  "follow_up",
  "re_engagement",
  "replan",
);
export const RunKindSchema = z.enum(runKinds);

export const runStatuses = defineValues(
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
);
export const RunStatusSchema = z.enum(runStatuses);

export const channels = defineValues("email", "whatsapp");
export const ChannelSchema = z.enum(channels);

export const evidenceKinds = defineValues("documentary", "statistical");
export const EvidenceKindSchema = z.enum(evidenceKinds);

export const edgeKinds = defineValues(
  "mentions",
  "employed_by",
  "competitor_of",
  "same_owner",
  "audience_overlap",
  "customer_of",
);
export const EdgeKindSchema = z.enum(edgeKinds);

export const policyDecisions = defineValues(
  "allow",
  "deny",
  "require_approval",
);
export const PolicyDecisionSchema = z.enum(policyDecisions);

export const adapterModes = defineValues("sim", "live", "plan");
export const AdapterModeSchema = z.enum(adapterModes);

export const approvalStatuses = defineValues("pending", "approved", "rejected");
export const ApprovalStatusSchema = z.enum(approvalStatuses);

export const messageStatuses = defineValues(
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "delivered",
  "failed",
);
export const MessageStatusSchema = z.enum(messageStatuses);

export const interactionKinds = defineValues(
  "delivered",
  "opened",
  "reply",
  "meeting_booked",
  "bounced",
  "opt_out",
);
export const InteractionKindSchema = z.enum(interactionKinds);

export const suppressionScopes = defineValues("workspace", "campaign");
export const SuppressionScopeSchema = z.enum(suppressionScopes);

export const capabilityIds = defineValues(
  "geo.query",
  "db.query",
  "web.fetch",
  "reviews.fetch",
  "people.find",
  "segment.build",
  "message.send",
  "ads.plan",
);
export const CapabilityIdSchema = z.enum(capabilityIds);
