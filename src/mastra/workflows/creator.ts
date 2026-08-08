import type { z } from "zod";
import { capabilityRegistry } from "../../capabilities";
import type { Adapter } from "../../capabilities/adapter";
import type { TargetCandidateSchema } from "../../contracts/capabilities";
import type { CreatorShortlistDataSchema } from "../../contracts/steps";
import { runCreatorSelector } from "../agents/creator-selector";
import type { StructuredAgent } from "../agents/runner";
import type { OrganizationInput, OrganizationRuntime } from "./organization";
import { executePlannedCapability } from "./replan";

type TargetCandidate = z.output<typeof TargetCandidateSchema>;
type CreatorCandidate = Extract<TargetCandidate, { readonly kind: "person" }>;
type CreatorSelection = z.output<
  typeof CreatorShortlistDataSchema
>["selected"][number];

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

function withSelection(
  candidate: Omit<CreatorCandidate, "kind">,
  choice: CreatorSelection,
) {
  return {
    ...candidate,
    payload: {
      ...candidate.payload,
      selection: {
        relevanceScore: choice.relevanceScore,
        reason: choice.reason,
      },
    },
  };
}

/** Selects up to ten creators and rejects references outside the supplied pool. */
export async function shortlistCreators(
  input: OrganizationInput,
  candidates: readonly TargetCandidate[],
  selector: StructuredAgent<z.output<typeof CreatorShortlistDataSchema>>,
) {
  const people = creatorCandidates(candidates);
  if (people.length === 0) {
    return {
      ok: false as const,
      reason: "Creator discovery returned no people.",
    };
  }

  const result = await runCreatorSelector(
    { spec: input.spec, candidates: people },
    selector,
  );
  if (!result.ok) {
    return result;
  }
  const available = new Map(
    people.map((candidate) => [candidate.externalRef, candidate]),
  );
  const seen = new Set<string>();
  const selected = [];

  for (const choice of result.data.selected) {
    const candidate = available.get(choice.externalRef);
    if (candidate === undefined) {
      return {
        ok: false as const,
        reason: `Creator selector returned an unknown candidate: ${choice.externalRef}.`,
      };
    }
    if (seen.has(choice.externalRef)) {
      return {
        ok: false as const,
        reason: `Creator selector returned ${choice.externalRef} more than once.`,
      };
    }
    seen.add(choice.externalRef);
    selected.push(withSelection(candidate, choice));
  }

  return { ok: true as const, candidates: selected };
}

/** Fetches the supported creator pool, ranks it with Claude, and attaches only the top ten. */
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
      limit: 100,
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
    { ...input, plan: discovered.plan },
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
      kind: "person",
      relationship: "prospect_partner",
    })),
  );
  await Promise.all(
    targets.map((target) => runtime.store.updateTarget(target.id, "fit")),
  );
  targets.forEach((target) => {
    runtime.replans.completeTarget(target.id);
  });

  return {
    ok: true,
    targetIds: targets.map((target) => target.id),
    failures: [],
  };
}
