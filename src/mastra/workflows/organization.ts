import type { z } from "zod";
import type { Adapter } from "../../capabilities/adapter";
import { executeCapability } from "../../capabilities/execute";
import { capabilityRegistry } from "../../capabilities/registry";
import type { TargetCandidateSchema } from "../../contracts/capabilities";
import type {
  Approval,
  Contact,
  Message,
  Signal,
  Target,
} from "../../contracts/entities";
import {
  AssessDataSchema,
  CreatorShortlistDataSchema,
  type CampaignSpecSchema,
  DraftDataSchema,
  ExtractEvidenceDataSchema,
  type PlanDataSchema,
  type SourceDocumentSchema,
} from "../../contracts/steps";
import type {
  NewApproval,
  NewAllocation,
  NewAssessment,
  NewContact,
  NewMessage,
  NewSignal,
  NewTarget,
} from "../../db/repositories";
import { verifyEvidence } from "../../evidence";
import { consentBasisByMotion, getMotion } from "../../motions";
import type { OrganizationMotionId } from "../../motions/types";
import { evaluatePolicies } from "../../policy";
import {
  selectReachableBusinesses,
  type LocationFinderData,
} from "../agents/location-finder";
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
  saveAllocation(allocation: NewAllocation): Promise<void>;
  saveSignals(signals: readonly NewSignal[]): Promise<readonly Signal[]>;
  saveAssessment(assessment: NewAssessment): Promise<void>;
  saveContact(contact: NewContact): Promise<Contact>;
  saveMessage(message: NewMessage): Promise<Message>;
  saveApproval(approval: NewApproval): Promise<Approval>;
  updateTarget(targetId: string, status: Target["status"]): Promise<void>;
}

export interface OrganizationAgents {
  readonly locationFinder: StructuredAgent<LocationFinderData>;
  readonly extract: StructuredAgent<ExtractEvidenceData>;
  readonly assess: StructuredAgent<AssessData>;
  readonly draft: StructuredAgent<DraftData>;
  readonly selectCreators: StructuredAgent<
    z.output<typeof CreatorShortlistDataSchema>
  >;
}

export interface OrganizationAdapters {
  readonly geo: readonly Adapter<"geo.query">[];
  readonly generatedGeo: Adapter<"geo.query">;
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

/** Returns the narrow target-category query while preserving legacy specs. */
export function organizationDiscoveryQuery(input: {
  readonly discoveryQuery?: string;
  readonly targetCriteria: readonly string[];
  readonly goal: string;
}): string {
  // Legacy specs used their first criterion as the discovery category.
  return input.discoveryQuery ?? input.targetCriteria[0] ?? input.goal;
}

function documentPrompt(
  spec: CampaignSpec,
  documents: readonly SourceDocument[],
): string {
  return JSON.stringify({
    campaignGoal: spec.goal,
    targetCriteria: spec.targetCriteria,
    documents,
  });
}

function organizationQualificationRubric(spec: CampaignSpec): string[] {
  return [
    `campaign_fit: Source-grounded evidence shows that this organization could benefit from the campaign offer: ${spec.goal}`,
    ...spec.targetCriteria.map(
      (criterion) => `prospect_criterion: ${criterion}`,
    ),
  ];
}

function assessmentPrompt(
  rubric: readonly string[],
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
    rubric,
  });
}

function draftPrompt(input: {
  readonly campaignId: string;
  readonly runId: string;
  readonly targetId: string;
  readonly workspaceName: string;
  readonly campaignGoal: string;
  readonly targetCriteria: readonly string[];
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
      documentPrompt(input.spec, documents),
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
    const rubric = organizationQualificationRubric(input.spec);
    const assessed = await runtime.agents.assess.generate(
      assessmentPrompt(rubric, {
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
      rubric,
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
        campaignGoal: input.spec.goal,
        targetCriteria: input.spec.targetCriteria,
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
    const savedMessage = await runtime.store.saveMessage({
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
    const pendingApproval = await runtime.store.saveApproval({
      campaignId: input.campaignId,
      runId: input.runId,
      messageId: savedMessage.id,
      decision: "require_approval",
      status: "pending",
      reason: policy.reason,
    });
    await runtime.events.emit({
      type: "approval.required",
      campaignId: input.campaignId,
      runId: input.runId,
      approval: pendingApproval,
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
  const query = organizationDiscoveryQuery(input.spec);
  let discovered: OrganizationDiscoveryResult;
  if (discoveryCapability === "geo.query") {
    discovered = await executePlannedCapability({
      capabilityId: "geo.query",
      capability: capabilityRegistry["geo.query"],
      input: {
        query,
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
          category: query,
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
  let candidates = discovered.data.targets;
  if (motionId === "business.local") {
    const select = async (available: readonly TargetCandidate[]) => {
      const organizations = available.flatMap((candidate) =>
        candidate.kind === "organization"
          ? [
              {
                externalRef: candidate.externalRef,
                name: candidate.name,
                ...candidate.payload,
              },
            ]
          : [],
      );
      const selections = await selectReachableBusinesses(
        {
          campaignGoal: input.spec.goal,
          geography: input.spec.geography,
          discoveryQuery: query,
          targetCriteria: input.spec.targetCriteria,
          channels: input.spec.channels,
          requiredCount: 10,
          candidates: organizations,
        },
        runtime.agents.locationFinder,
      );
      const byExternalRef = new Map(
        available.map((candidate) => [candidate.externalRef, candidate]),
      );
      return selections.map(({ candidate }) => {
        const selected = byExternalRef.get(candidate.externalRef);
        if (selected === undefined) {
          throw new Error(
            `Location Finder lost selected business ${candidate.externalRef}.`,
          );
        }
        return selected;
      });
    };

    let selected = await select(candidates);
    if (selected.length < 10) {
      const generated = await executeCapability({
        context,
        capability: capabilityRegistry["geo.query"],
        binding: {
          capabilityId: "geo.query",
          adapterId: runtime.adapters.generatedGeo.id,
          mode: runtime.adapters.generatedGeo.mode,
        },
        adapter: runtime.adapters.generatedGeo,
        input: {
          query,
          locality: input.spec.geography,
          latitude: 0,
          longitude: 0,
          radiusKm: 30,
          limit: 60,
        },
        ledger: runtime.ledger,
      });
      const merged = new Map(
        [...candidates, ...generated.targets].map((candidate) => [
          candidate.externalRef,
          candidate,
        ]),
      );
      candidates = [...merged.values()];
      selected = await select(candidates);
    }
    if (selected.length === 0) {
      throw new Error(
        "Location Finder found no relevant prospective customers for this campaign.",
      );
    }
    candidates = selected;
  }
  const targets = await runtime.store.saveTargets(
    candidates.map((target) => ({
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
