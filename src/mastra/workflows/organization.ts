import type { z } from "zod";
import type { Adapter } from "../../capabilities/adapter";
import { capabilityRegistry } from "../../capabilities/registry";
import type { TargetCandidateSchema } from "../../contracts/capabilities";
import type {
  Contact,
  Message,
  Signal,
  Target,
} from "../../contracts/entities";
import {
  AssessDataSchema,
  type CampaignSpecSchema,
  DraftDataSchema,
  ExtractEvidenceDataSchema,
  type PlanDataSchema,
  type SourceDocumentSchema,
} from "../../contracts/steps";
import type {
  NewAssessment,
  NewContact,
  NewMessage,
  NewSignal,
  NewTarget,
} from "../../db/repositories";
import { verifyEvidence } from "../../evidence";
import {
  assessmentRubric,
  consentBasisByMotion,
  getMotion,
} from "../../motions";
import type { MotionId, OrganizationMotionId } from "../../motions/types";
import { evaluatePolicies } from "../../policy";
import type { StructuredAgent } from "../agents/runner";
import {
  executePlannedCapability,
  type ReplanController,
  type WorkflowEventSink,
} from "./replan";

type CampaignSpec = z.output<typeof CampaignSpecSchema>;
type PlanData = z.output<typeof PlanDataSchema>;
type SourceDocument = z.output<typeof SourceDocumentSchema>;
type ExtractEvidenceData = z.output<typeof ExtractEvidenceDataSchema>;
type AssessData = z.output<typeof AssessDataSchema>;
type DraftData = z.output<typeof DraftDataSchema>;
type TargetCandidate = z.output<typeof TargetCandidateSchema>;
type OrganizationDiscoveryResult =
  | {
      readonly ok: true;
      readonly data: { readonly targets: readonly TargetCandidate[] };
      readonly plan: PlanData;
    }
  | { readonly ok: false; readonly reason: string };

export interface OrganizationStore {
  saveTargets(targets: readonly NewTarget[]): Promise<readonly Target[]>;
  saveSignals(signals: readonly NewSignal[]): Promise<readonly Signal[]>;
  saveAssessment(assessment: NewAssessment): Promise<void>;
  saveContact(contact: NewContact): Promise<Contact>;
  saveMessage(message: NewMessage): Promise<Message>;
  updateTarget(targetId: string, status: Target["status"]): Promise<void>;
}

export interface OrganizationAgents {
  readonly extract: StructuredAgent<ExtractEvidenceData>;
  readonly assess: StructuredAgent<AssessData>;
  readonly draft: StructuredAgent<DraftData>;
}

export interface OrganizationAdapters {
  readonly geo: readonly Adapter<"geo.query">[];
  readonly db: readonly Adapter<"db.query">[];
  readonly web: readonly Adapter<"web.fetch">[];
  readonly reviews: readonly Adapter<"reviews.fetch">[];
  readonly people: readonly Adapter<"people.find">[];
}

export interface OrganizationRuntime {
  readonly store: OrganizationStore;
  readonly agents: OrganizationAgents;
  readonly adapters: OrganizationAdapters;
  readonly ledger: import("../../capabilities/execute").ToolCallWriter;
  readonly replans: ReplanController;
  events: WorkflowEventSink;
}

export interface OrganizationInput {
  readonly workspaceName: string;
  readonly campaignId: string;
  readonly runId: string;
  readonly spec: CampaignSpec;
  readonly plan: PlanData;
}

export interface TargetSuccess {
  readonly ok: true;
  readonly targetId: string;
  readonly isFit: boolean;
  readonly droppedCount: number;
  readonly plan: PlanData;
}

export interface TargetFailure {
  readonly ok: false;
  readonly targetId: string;
  readonly reason: string;
}

export type TargetResult = TargetSuccess | TargetFailure;

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown target failure.";
}

function documentPrompt(documents: readonly SourceDocument[]): string {
  return JSON.stringify({ documents });
}

function assessmentPrompt(
  motionId: MotionId,
  input: {
    readonly campaignId: string;
    readonly runId: string;
    readonly targetId: string;
    readonly signals: readonly Signal[];
    readonly droppedCount: number;
  },
): string {
  // This serialization is the evidence firewall: raw documents are not accepted here.
  return JSON.stringify({
    ...input,
    signals: input.signals,
    rubric: assessmentRubric(getMotion(motionId)),
  });
}

function draftPrompt(input: {
  readonly campaignId: string;
  readonly runId: string;
  readonly targetId: string;
  readonly workspaceName: string;
  readonly contact: {
    readonly name: string;
    readonly role: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly confidence: number;
  };
  readonly channel: "email" | "whatsapp";
  readonly signals: readonly Signal[];
}): string {
  return JSON.stringify(input);
}

/** Executes one target independently; this is the failure boundary used by foreach. */
export async function processOrganizationTarget(
  motionId: OrganizationMotionId,
  input: OrganizationInput & { readonly target: Target },
  runtime: OrganizationRuntime,
): Promise<TargetResult> {
  try {
    let plan = input.plan;
    const documents: SourceDocument[] = [];
    if (input.target.kind !== "organization") {
      return {
        ok: false,
        targetId: input.target.id,
        reason: `${motionId} requires an organization target.`,
      };
    }
    for (const capabilityId of getMotion(motionId).observation) {
      if (capabilityId === "web.fetch") {
        if (input.target.payload.websiteUrl === null) {
          continue;
        }
        const web = await executePlannedCapability({
          capabilityId,
          capability: capabilityRegistry[capabilityId],
          input: {
            externalRef: input.target.externalRef,
            url: input.target.payload.websiteUrl,
          },
          plan,
          adapters: runtime.adapters.web,
          context: {
            campaignId: input.campaignId,
            runId: input.runId,
            targetId: input.target.id,
          },
          ledger: runtime.ledger,
          replans: runtime.replans,
        });
        if (!web.ok) {
          return { ...web, targetId: input.target.id };
        }
        plan = web.plan;
        documents.push({ kind: "web", document: web.data });
        continue;
      }
      if (capabilityId === "reviews.fetch") {
        const reviews = await executePlannedCapability({
          capabilityId,
          capability: capabilityRegistry[capabilityId],
          input: { externalRef: input.target.externalRef, limit: 6 },
          plan,
          adapters: runtime.adapters.reviews,
          context: {
            campaignId: input.campaignId,
            runId: input.runId,
            targetId: input.target.id,
          },
          ledger: runtime.ledger,
          replans: runtime.replans,
        });
        if (!reviews.ok) {
          return { ...reviews, targetId: input.target.id };
        }
        plan = reviews.plan;
        documents.push({
          kind: "reviews",
          sourceRef: reviews.data.sourceRef,
          reviews: reviews.data.reviews,
        });
        continue;
      }
      throw new Error(
        `${motionId} declares unsupported observation capability ${capabilityId}.`,
      );
    }
    await runtime.store.updateTarget(input.target.id, "observed");

    const extracted = await runtime.agents.extract.generate(
      documentPrompt(documents),
    );
    const extractedData = ExtractEvidenceDataSchema.parse(extracted.object);
    const verified = verifyEvidence(
      {
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: input.target.id,
      },
      documents,
      extractedData.signals,
    );
    const signals = await runtime.store.saveSignals(verified.signals);
    const assessed = await runtime.agents.assess.generate(
      assessmentPrompt(motionId, {
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: input.target.id,
        signals,
        droppedCount: verified.droppedCount,
      }),
    );
    const assessment = AssessDataSchema.parse(assessed.object);
    await runtime.store.saveAssessment({
      campaignId: input.campaignId,
      runId: input.runId,
      targetId: input.target.id,
      score: assessment.score,
      isFit: assessment.isFit,
      reason: assessment.reason,
      droppedCount: verified.droppedCount,
      rubric: assessmentRubric(getMotion(motionId)),
    });
    await runtime.events.emit({
      type: "assessment.recorded",
      campaignId: input.campaignId,
      runId: input.runId,
      targetId: input.target.id,
      score: assessment.score,
      isFit: assessment.isFit,
      reason: assessment.reason,
      droppedCount: verified.droppedCount,
    });
    await runtime.store.updateTarget(
      input.target.id,
      assessment.isFit ? "fit" : "not_fit",
    );
    if (!assessment.isFit) {
      runtime.replans.completeTarget(input.target.id);
      return {
        ok: true,
        targetId: input.target.id,
        isFit: false,
        droppedCount: verified.droppedCount,
        plan,
      };
    }

    const contact = await executePlannedCapability({
      capabilityId: "people.find",
      capability: capabilityRegistry["people.find"],
      input: {
        externalRef: input.target.externalRef,
        channels: [...getMotion(motionId).channels],
      },
      plan,
      adapters: runtime.adapters.people,
      context: {
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: input.target.id,
      },
      ledger: runtime.ledger,
      replans: runtime.replans,
    });
    if (!contact.ok) {
      return { ...contact, targetId: input.target.id };
    }
    plan = contact.plan;
    const person = contact.data.people.find(
      (candidate) => candidate.phone !== null || candidate.email !== null,
    );
    if (person === undefined) {
      return {
        ok: false,
        targetId: input.target.id,
        reason: "No contactable decision-maker was found.",
      };
    }
    const channel = person.phone === null ? "email" : "whatsapp";
    const address = channel === "email" ? person.email : person.phone;
    if (address === null) {
      return {
        ok: false,
        targetId: input.target.id,
        reason: `The selected ${channel} contact has no address.`,
      };
    }
    const drafted = await runtime.agents.draft.generate(
      draftPrompt({
        campaignId: input.campaignId,
        runId: input.runId,
        targetId: input.target.id,
        workspaceName: input.workspaceName,
        contact: person,
        channel,
        signals,
      }),
    );
    const draft = DraftDataSchema.parse(drafted.object);
    const evidenceIds = new Set(signals.map((signal) => signal.id));
    const unsupportedSentence = draft.sentences.find(
      (sentence) => !evidenceIds.has(sentence.evidenceId),
    );
    if (unsupportedSentence !== undefined) {
      return {
        ok: false,
        targetId: input.target.id,
        reason: `Draft sentence references unknown evidence ${unsupportedSentence.evidenceId}.`,
      };
    }
    const policy = evaluatePolicies([
      { kind: "require_approval", action: "send", approved: false },
      {
        kind: "consent_policy",
        motionId,
        consentBasis: getMotion(motionId).consentPolicy,
        basisByMotion: consentBasisByMotion(),
      },
    ]);
    if (policy.decision !== "require_approval") {
      return {
        ok: false,
        targetId: input.target.id,
        reason: policy.reason,
      };
    }
    const savedContact = await runtime.store.saveContact({
      campaignId: input.campaignId,
      targetId: input.target.id,
      channel,
      address,
      displayName: person.name,
      consentBasis: getMotion(motionId).consentPolicy,
      verified: true,
    });
    await runtime.store.saveMessage({
      campaignId: input.campaignId,
      targetId: input.target.id,
      contactId: savedContact.id,
      runId: input.runId,
      channel,
      status: "pending_approval",
      subject: draft.subject,
      body: draft.sentences.map((sentence) => sentence.text).join(" "),
      evidenceIds: draft.sentences.map((sentence) => sentence.evidenceId),
    });
    await runtime.store.updateTarget(input.target.id, "pending_approval");
    runtime.replans.completeTarget(input.target.id);
    return {
      ok: true,
      targetId: input.target.id,
      isFit: true,
      droppedCount: verified.droppedCount,
      plan,
    };
  } catch (error) {
    return {
      ok: false,
      targetId: input.target.id,
      reason: errorReason(error),
    };
  }
}

/** Executes the motion's single discovery call and persists its deduplicated targets. */
export async function discoverOrganization(
  motionId: OrganizationMotionId,
  input: OrganizationInput,
  runtime: OrganizationRuntime,
): Promise<
  | {
      readonly ok: true;
      readonly targets: readonly Target[];
      readonly plan: PlanData;
    }
  | { readonly ok: false; readonly reason: string }
> {
  const context = {
    campaignId: input.campaignId,
    runId: input.runId,
    targetId: null,
  };
  const discoveryCapability = getMotion(motionId).discovery[0];
  let discovered: OrganizationDiscoveryResult;
  if (discoveryCapability === "geo.query") {
    discovered = await executePlannedCapability({
      capabilityId: "geo.query",
      capability: capabilityRegistry["geo.query"],
      input: {
        query: input.spec.targetCriteria.join(" "),
        locality: input.spec.geography,
        latitude: 0,
        longitude: 0,
        radiusKm: 30,
        limit: 60,
      },
      plan: input.plan,
      adapters: runtime.adapters.geo,
      context,
      ledger: runtime.ledger,
      replans: runtime.replans,
    });
  } else if (discoveryCapability === "db.query") {
    discovered = await executePlannedCapability({
      capabilityId: "db.query",
      capability: capabilityRegistry["db.query"],
      input: {
        entityKind: "company",
        filters: {
          category: input.spec.targetCriteria[0],
          locality: input.spec.geography,
        },
        limit: 60,
      },
      plan: input.plan,
      adapters: runtime.adapters.db,
      context,
      ledger: runtime.ledger,
      replans: runtime.replans,
    });
  } else {
    return {
      ok: false,
      reason: `${motionId} declares unsupported discovery capability ${discoveryCapability}.`,
    };
  }
  if (!discovered.ok) {
    return discovered;
  }
  const targets = await runtime.store.saveTargets(
    discovered.data.targets.map((target) => ({
      ...target,
      campaignId: input.campaignId,
      motionId,
      relationship: "prospect",
    })),
  );
  return { ok: true, targets, plan: discovered.plan };
}

/** Discovers once, persists once, then runs independent targets at concurrency eight. */
export async function runOrganization(
  motionId: OrganizationMotionId,
  input: OrganizationInput,
  runtime: OrganizationRuntime,
): Promise<readonly TargetResult[]> {
  const discovered = await discoverOrganization(motionId, input, runtime);
  if (!discovered.ok) {
    return [
      { ok: false, targetId: input.campaignId, reason: discovered.reason },
    ];
  }
  const activePlan = discovered.plan;
  const targets = discovered.targets;
  const results: TargetResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < targets.length) {
      const target = targets[cursor];
      cursor += 1;
      if (target !== undefined) {
        results.push(
          await processOrganizationTarget(
            motionId,
            { ...input, plan: activePlan, target },
            runtime,
          ),
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(8, targets.length) }, () => worker()),
  );
  return results;
}
