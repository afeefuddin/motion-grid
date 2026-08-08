import type { z } from "zod";
import { capabilityRegistry } from "../../capabilities";
import type { Adapter } from "../../capabilities/adapter";
import type { TargetCandidateSchema } from "../../contracts/capabilities";
import { CreatorShortlistDataSchema } from "../../contracts/steps";
import type { StructuredAgent } from "../agents/runner";
import type { OrganizationInput, OrganizationRuntime } from "./organization";
import { executePlannedCapability } from "./replan";
import { runCreatorSelector } from "../agents/creator-selector";

type TargetCandidate = z.output<typeof TargetCandidateSchema>;
type CreatorSelection = z.output<typeof CreatorShortlistDataSchema>["selected"][number];

function creatorCandidates(candidates: readonly TargetCandidate[]) {
  return candidates.flatMap((candidate) =>
    candidate.kind === "person"
      ? [
          {
            externalRef: candidate.externalRef,
            name: candidate.name,
            payload: candidate.payload,
          },
        ]
      : [],
  );
}

/** Selects up to ten candidate creators and refuses model references outside the supplied list. */
export async function shortlistCreators(
  input: OrganizationInput,
  candidates: readonly TargetCandidate[],
  selector: StructuredAgent<z.output<typeof CreatorShortlistDataSchema>>,
) {
  const people = creatorCandidates(candidates);
  if (people.length === 0) {
    return { ok: false as const, reason: "Creator discovery returned no people." };
  }

  const result = await runCreatorSelector(
    { spec: input.spec, candidates: people },
    selector,
  );
  const available = new Map(people.map((candidate) => [candidate.externalRef, candidate]));
  const selected = new Map<string, CreatorSelection>();
  for (const choice of result.data.selected) {
    if (!available.has(choice.externalRef)) {
      return {
        ok: false as const,
        reason: `Creator selector returned an unknown candidate: ${choice.externalRef}.`,
      };
    }
    if (selected.has(choice.externalRef)) {
      return {
        ok: false as const,
        reason: `Creator selector returned ${choice.externalRef} more than once.`,
      };
    }
    selected.set(choice.externalRef, choice);
  }

  return {
    ok: true as const,
    candidates: people.flatMap((candidate) => {
      const choice = selected.get(candidate.externalRef);
      return choice === undefined
        ? []
        : [
            {
              ...candidate,
              payload: {
                ...candidate.payload,
                selection: {
                  relevanceScore: choice.relevanceScore,
                  reason: choice.reason,
                },
              },
            },
          ];
    }),
  };
}

/** Discovers creators once, asks the selector to rank the whole pool, and persists its top ten. */
export async function runCreatorMotion(
  input: OrganizationInput,
  runtime: OrganizationRuntime,
  adapters: readonly Adapter<"db.query">[],
): Promise<{
  readonly ok: boolean;
  readonly targetIds: readonly string[];
  readonly failures: readonly string[];
}> {
  const discovered = await executePlannedCapability({
    capabilityId: "db.query",
    capability: capabilityRegistry["db.query"],
    input: {
      entityKind: "creator",
      filters: {},
      limit: 60,
    },
    plan: input.plan,
    adapters,
    context: {
      campaignId: input.campaignId,
      runId: input.runId,
      targetId: null,
    },
    ledger: runtime.ledger,
    replans: runtime.replans,
  });
  if (!discovered.ok) {
    return { ok: false, targetIds: [], failures: [discovered.reason] };
  }

  const shortlisted = await shortlistCreators(
    input,
    discovered.data.targets,
    runtime.agents.selectCreators,
  );
  if (!shortlisted.ok) {
    return { ok: false, targetIds: [], failures: [shortlisted.reason] };
  }

  const targets = await runtime.store.saveTargets(
    shortlisted.candidates.map((candidate) => ({
      ...candidate,
      campaignId: input.campaignId,
      motionId: "creator",
      relationship: "prospect_partner",
    })),
  );
  await Promise.all(
    targets.map((target) => runtime.store.updateTarget(target.id, "fit")),
  );
  targets.forEach((target) => runtime.replans.completeTarget(target.id));
  return { ok: true, targetIds: targets.map((target) => target.id), failures: [] };
}
