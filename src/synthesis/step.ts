import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  type Signal,
  SynthesizeInputSchema,
  SynthesizeOutputSchema,
  type Target,
} from "../contracts";
import { db } from "../db/client";
import {
  allocationRepo,
  edgeRepo,
  signalRepo,
  targetRepo,
} from "../db/repositories";
import type { NewEdge } from "../db/repositories/types";
import { assessment, campaign, interaction, message } from "../db/schema";
import { simWorld } from "../sim/world";
import type { CreatorAllocationResult } from "./allocation";
import { discoverMentionEdges } from "./edges";

/** Persists every creator allocation winner and loser for a campaign. */
export async function persistCreatorAllocation(
  campaignId: string,
  result: CreatorAllocationResult,
): Promise<void> {
  for (const decision of result.decisions) {
    await allocationRepo.create({
      campaignId,
      targetId: decision.targetId,
      motionId: "creator",
      commitCents: decision.pricePaise,
      selected: decision.selected,
      reason: `${decision.reason} Effective fit ${decision.effectiveFitScore.toFixed(2)}; overlap penalty ${Math.round(decision.overlapPenalty * 100)}%.`,
    });
  }
}

function byExternalRef(targets: readonly Target[]): Map<string, Target> {
  return new Map(targets.map((target) => [target.externalRef, target]));
}

/**
 * Deduplicates motion targets, discovers shared-graph mentions, and rolls up outcomes.
 */
export async function synthesizeStep(rawInput: unknown) {
  const input = SynthesizeInputSchema.parse(rawInput);
  const targetIds = [...new Set(input.targetIds)];
  const campaignTargets = await targetRepo.byCampaign(input.campaignId);
  const selectedTargets = campaignTargets.filter((target) =>
    targetIds.includes(target.id),
  );
  const targetsByExternalRef = byExternalRef(selectedTargets);
  const businessExternalRefs = new Set(
    selectedTargets
      .filter((target) => target.kind === "organization")
      .map((target) => target.externalRef),
  );
  const creatorExternalRefs = new Set(
    selectedTargets
      .filter((target) => target.kind === "person")
      .map((target) => target.externalRef),
  );
  const mentions = discoverMentionEdges(
    simWorld.creators.filter((creator) => creatorExternalRefs.has(creator.id)),
    simWorld.businesses.filter((business) =>
      businessExternalRefs.has(business.id),
    ),
  );

  const existingSignals = await signalRepo.byCampaign(input.campaignId);
  const evidenceBySource = new Map<string, Signal>();
  for (const signal of existingSignals) {
    if (signal.evidenceKind === "documentary") {
      evidenceBySource.set(signal.payload.sourceRef, signal);
    }
  }
  for (const mention of mentions) {
    const sourceRef = `creator-post:${mention.postExternalRef}`;
    if (!evidenceBySource.has(sourceRef)) {
      const creatorTarget = targetsByExternalRef.get(
        mention.creatorExternalRef,
      );
      if (creatorTarget === undefined) {
        throw new Error(
          `Creator target ${mention.creatorExternalRef} is missing.`,
        );
      }
      const created = await signalRepo.bulkCreate([
        {
          campaignId: input.campaignId,
          targetId: creatorTarget.id,
          runId: input.runId,
          evidenceKind: "documentary",
          payload: {
            sourceRef,
            excerpt: mention.evidence,
            verified: true,
            implication:
              "The creator has an existing relationship signal with this business.",
            strength: mention.confidence,
          },
        },
      ]);
      const evidence = created.find(() => true);
      if (evidence === undefined) {
        throw new Error(`Mention evidence ${sourceRef} was not persisted.`);
      }
      evidenceBySource.set(sourceRef, evidence);
    }
  }

  const discoveredEdges = mentions.map((mention): NewEdge => {
    const creatorTarget = targetsByExternalRef.get(mention.creatorExternalRef);
    const businessTarget = targetsByExternalRef.get(
      mention.businessExternalRef,
    );
    const evidence = evidenceBySource.get(
      `creator-post:${mention.postExternalRef}`,
    );
    if (
      creatorTarget === undefined ||
      businessTarget === undefined ||
      evidence === undefined
    ) {
      throw new Error(
        "A discovered mention cannot be mapped to persisted entities.",
      );
    }
    return {
      campaignId: input.campaignId,
      fromTargetId: creatorTarget.id,
      toTargetId: businessTarget.id,
      kind: "mentions",
      evidenceId: evidence.id,
      confidence: mention.confidence,
    };
  });
  await edgeRepo.bulkCreate(discoveredEdges);

  const filterByTargets =
    targetIds.length === 0
      ? sql`false`
      : inArray(assessment.targetId, targetIds);
  const [fitRows, sentRows, engagedRows, campaignRows] = await Promise.all([
    db
      .select({ value: count(sql`distinct ${assessment.targetId}`) })
      .from(assessment)
      .where(
        and(
          eq(assessment.campaignId, input.campaignId),
          eq(assessment.isFit, true),
          filterByTargets,
        ),
      ),
    db
      .select({ value: count(sql`distinct ${message.targetId}`) })
      .from(message)
      .where(
        and(
          eq(message.campaignId, input.campaignId),
          inArray(message.status, ["sent", "delivered"]),
          targetIds.length === 0
            ? sql`false`
            : inArray(message.targetId, targetIds),
        ),
      ),
    db
      .select({ value: count(sql`distinct ${interaction.targetId}`) })
      .from(interaction)
      .where(
        and(
          eq(interaction.campaignId, input.campaignId),
          inArray(interaction.kind, ["reply", "meeting_booked"]),
          targetIds.length === 0
            ? sql`false`
            : inArray(interaction.targetId, targetIds),
        ),
      ),
    db
      .select()
      .from(campaign)
      .where(eq(campaign.id, input.campaignId))
      .limit(1),
  ]);
  const campaignRow = campaignRows.find(() => true);
  const fitCount = fitRows.find(() => true);
  const sentCount = sentRows.find(() => true);
  const engagedCount = engagedRows.find(() => true);
  if (campaignRow === undefined) {
    throw new Error(`Campaign ${input.campaignId} is missing.`);
  }
  if (
    fitCount === undefined ||
    sentCount === undefined ||
    engagedCount === undefined
  ) {
    throw new Error("Campaign outcome aggregation returned no count row.");
  }
  const outcome = {
    targetCount: selectedTargets.length,
    fitCount: fitCount.value,
    sentCount: sentCount.value,
    engagedCount: engagedCount.value,
    operatingSpentCents: campaignRow.operatingSpentCents,
    commitSpentCents: campaignRow.commitSpentCents,
  };
  await db
    .update(campaign)
    .set({ outcome, updatedAt: new Date() })
    .where(eq(campaign.id, input.campaignId));

  return SynthesizeOutputSchema.parse({
    ok: true,
    data: {
      edges: discoveredEdges.map((edge) => ({
        fromTargetId: edge.fromTargetId,
        toTargetId: edge.toTargetId,
        kind: edge.kind,
        evidenceId: edge.evidenceId,
        confidence: edge.confidence,
      })),
      outcome,
    },
  });
}
