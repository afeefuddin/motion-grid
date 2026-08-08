import type { CapabilityId } from "../contracts/capabilities";
import { defineValues } from "../contracts/enums";
import {
  consumerAdsRubric,
  consumerEmailRubric,
  creatorRubric,
  localB2BRubric,
  onlineB2BRubric,
} from "./rubrics";
import type { MotionId } from "./types";
import { defineMotion, type MotionDefinition } from "./types";

export const motionRegistry = {
  creator: defineMotion("creator", {
    requiresWorkspaceSource: null,
    targetKind: "person",
    discovery: ["db.query"],
    discoveryTrigger: null,
    observation: [],
    rubric: creatorRubric,
    contactModel: "individual",
    channels: ["email", "whatsapp"],
    allocation: true,
    terminalState: "partnership_active",
    consentPolicy: "explicit_opt_in",
  }),
  "business.local": defineMotion("business.local", {
    requiresWorkspaceSource: null,
    targetKind: "organization",
    discovery: ["geo.query"],
    discoveryTrigger: null,
    observation: ["web.fetch", "reviews.fetch"],
    rubric: localB2BRubric,
    contactModel: "individual",
    channels: ["whatsapp", "email"],
    allocation: false,
    terminalState: "meeting_booked",
    consentPolicy: "legitimate_interest",
  }),
  "business.online": defineMotion("business.online", {
    requiresWorkspaceSource: null,
    targetKind: "organization",
    discovery: ["db.query"],
    discoveryTrigger: null,
    observation: ["web.fetch", "reviews.fetch"],
    rubric: onlineB2BRubric,
    contactModel: "individual",
    channels: ["email", "whatsapp"],
    allocation: false,
    terminalState: "meeting_booked",
    consentPolicy: "legitimate_interest",
  }),
  "consumer.ads": defineMotion("consumer.ads", {
    requiresWorkspaceSource: "first_party_customers",
    targetKind: "segment",
    discovery: ["segment.build"],
    discoveryTrigger: null,
    observation: [],
    rubric: consumerAdsRubric,
    contactModel: "none",
    channels: [],
    allocation: true,
    terminalState: "media_plan_ready",
    consentPolicy: "legitimate_interest",
  }),
  "consumer.email": defineMotion("consumer.email", {
    requiresWorkspaceSource: "first_party_customers",
    targetKind: "person",
    discovery: [],
    discoveryTrigger: "customer_base",
    observation: [],
    rubric: consumerEmailRubric,
    contactModel: "individual",
    channels: ["email"],
    allocation: false,
    terminalState: "converted",
    consentPolicy: "explicit_opt_in",
  }),
} satisfies Readonly<Record<MotionId, MotionDefinition>>;

export const organizationMotionIds = defineValues(
  "business.local",
  "business.online",
);

export function getMotion<Id extends MotionId>(id: Id) {
  return motionRegistry[id];
}

export function declaredCapabilities(): CapabilityId[] {
  return Object.values(motionRegistry).flatMap((motion) => [
    ...motion.discovery,
    ...motion.observation,
  ]);
}

export function consentBasisByMotion(): Record<
  MotionId,
  MotionDefinition["consentPolicy"]
> {
  return {
    creator: motionRegistry.creator.consentPolicy,
    "business.local": motionRegistry["business.local"].consentPolicy,
    "business.online": motionRegistry["business.online"].consentPolicy,
    "consumer.ads": motionRegistry["consumer.ads"].consentPolicy,
    "consumer.email": motionRegistry["consumer.email"].consentPolicy,
  };
}
