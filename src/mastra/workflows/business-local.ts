import type { z } from "zod";
import type { Adapter } from "../../capabilities/adapter";
import { capabilityRegistry } from "../../capabilities/registry";
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
import { assessmentRubric, getMotion } from "../../motions";
import { evaluatePolicies } from "../../policy";
import type { StructuredAgent } from "../agents/runner";
import { executePlannedCapability, type ReplanController } from "./replan";

type CampaignSpec = z.output<typeof CampaignSpecSchema>;
type PlanData = z.output<typeof PlanDataSchema>;
type SourceDocument = z.output<typeof SourceDocumentSchema>;
type ExtractEvidenceData = z.output<typeof ExtractEvidenceDataSchema>;
type AssessData = z.output<typeof AssessDataSchema>;
type DraftData = z.output<typeof DraftDataSchema>;

export interface BusinessLocalStore {
  saveTargets(targets: readonly NewTarget[]): Promise<readonly Target[]>;
  saveSignals(signals: readonly NewSignal[]): Promise<readonly Signal[]>;
  saveAssessment(assessment: NewAssessment): Promise<void>;
  saveContact(contact: NewContact): Promise<Contact>;
  saveMessage(message: NewMessage): Promise<Message>;
  updateTarget(targetId: string, status: Target["status"]): Promise<void>;
}

export interface BusinessLocalAgents {
  readonly extract: StructuredAgent<ExtractEvidenceData>;
  readonly assess: StructuredAgent<AssessData>;
  readonly draft: StructuredAgent<DraftData>;
}

export interface BusinessLocalAdapters {
  readonly geo: readonly Adapter<"geo.query">[];
  readonly web: readonly Adapter<"web.fetch">[];
  readonly reviews: readonly Adapter<"reviews.fetch">[];
  readonly people: readonly Adapter<"people.find">[];
}

export interface BusinessLocalRuntime {
  readonly store: BusinessLocalStore;
  readonly agents: BusinessLocalAgents;
  readonly adapters: BusinessLocalAdapters;
  readonly ledger: import("../../capabilities/execute").ToolCallWriter;
  readonly replans: ReplanController;
}

export interface BusinessLocalInput {
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

function assessmentPrompt(input: {
  readonly campaignId: string;
  readonly runId: string;
  readonly targetId: string;
  readonly signals: readonly Signal[];
  readonly droppedCount: number;
}): string {
  // This serialization is the evidence firewall: raw documents are not accepted here.
  return JSON.stringify({
    ...input,
    signals: input.signals,
    rubric: assessmentRubric(getMotion("business.local")),
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
export async function processBusinessLocalTarget(
  input: BusinessLocalInput & { readonly target: Target },
  runtime: BusinessLocalRuntime,
): Promise<TargetResult> {
  try {
    let plan = input.plan;
    const documents: SourceDocument[] = [];
    if (input.target.kind !== "organization") {
      return {
        ok: false,
        targetId: input.target.id,
        reason: "business.local requires an organization target.",
      };
    }
    if (input.target.payload.websiteUrl !== null) {
      const web = await executePlannedCapability({
        capabilityId: "web.fetch",
        capability: capabilityRegistry["web.fetch"],
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
    }
    const reviews = await executePlannedCapability({
      capabilityId: "reviews.fetch",
      capability: capabilityRegistry["reviews.fetch"],
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
      assessmentPrompt({
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
      rubric: assessmentRubric(getMotion("business.local")),
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
        channels: [...getMotion("business.local").channels],
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
        motionId: "business.local",
        consentBasis: "legitimate_interest",
        basisByMotion: {
          creator: "explicit_opt_in",
          "business.local": "legitimate_interest",
          "business.online": "legitimate_interest",
          "consumer.ads": "legitimate_interest",
          "consumer.email": "explicit_opt_in",
        },
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
      consentBasis: "legitimate_interest",
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
export async function discoverBusinessLocal(
  input: BusinessLocalInput,
  runtime: BusinessLocalRuntime,
): Promise<
  | {
      readonly ok: true;
      readonly targets: readonly Target[];
      readonly plan: PlanData;
    }
  | { readonly ok: false; readonly reason: string }
> {
  const discovered = await executePlannedCapability({
    capabilityId: "geo.query",
    capability: capabilityRegistry["geo.query"],
    input: {
      query: input.spec.targetCriteria.join(" "),
      latitude: 12.9716,
      longitude: 77.5946,
      radiusKm: 30,
      limit: 60,
    },
    plan: input.plan,
    adapters: runtime.adapters.geo,
    context: {
      campaignId: input.campaignId,
      runId: input.runId,
      targetId: null,
    },
    ledger: runtime.ledger,
    replans: runtime.replans,
  });
  if (!discovered.ok) {
    return discovered;
  }
  const targets = await runtime.store.saveTargets(
    discovered.data.targets.map((target) => ({
      ...target,
      campaignId: input.campaignId,
      relationship: "prospect",
    })),
  );
  return { ok: true, targets, plan: discovered.plan };
}

/** Discovers once, persists once, then runs independent targets at concurrency eight. */
export async function runBusinessLocal(
  input: BusinessLocalInput,
  runtime: BusinessLocalRuntime,
): Promise<readonly TargetResult[]> {
  const discovered = await discoverBusinessLocal(input, runtime);
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
          await processBusinessLocalTarget(
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
