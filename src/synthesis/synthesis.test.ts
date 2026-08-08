import assert from "node:assert/strict";
import { test } from "node:test";
import { simWorld } from "../sim/world";
import { allocateCreators } from "./allocation";
import { discoverMentionEdges, normalizeMentionText } from "./edges";

test("edge discovery finds only T2's planted creator mentions", () => {
  const edges = discoverMentionEdges(simWorld.creators, simWorld.businesses);
  assert.deepEqual(
    edges.map((edge) => [edge.creatorExternalRef, edge.businessExternalRef]),
    [
      ["creator-03", "business-01"],
      ["creator-12", "business-11"],
      ["creator-20", "business-33"],
    ],
  );
  assert.ok(edges.every((edge) => edge.evidence.length > 0));
  assert.equal(
    normalizeMentionText("Bloom Salon, Indiranagar"),
    "bloom indiranagar",
  );
});

test("allocation applies overlap discounts and keeps excluded creators visible", () => {
  const result = allocateCreators({
    creators: [
      { targetId: "a", name: "A", fitScore: 0.9, ratePaise: 5_000_000 },
      { targetId: "b", name: "B", fitScore: 0.88, ratePaise: 5_000_000 },
      { targetId: "c", name: "C", fitScore: 0.75, ratePaise: 5_000_000 },
      { targetId: "d", name: "D", fitScore: 1, ratePaise: 18_000_000 },
    ],
    audienceOverlaps: [
      { firstTargetId: "a", secondTargetId: "b", confidence: 0.8 },
    ],
    commitBudgetPaise: 10_000_000,
    maxPerDealPaise: 10_000_000,
  });

  assert.deepEqual(result.chosenTargetIds, ["a", "c"]);
  assert.equal(result.totalCommitPaise, 10_000_000);
  const overlapLoser = result.decisions.at(1);
  const capLoser = result.decisions.at(3);
  if (overlapLoser === undefined || capLoser === undefined) {
    throw new Error("Allocation result omitted a visible loser.");
  }
  assert.match(overlapLoser.reason, /remaining budget/);
  assert.match(capLoser.reason, /₹1,80,000 exceeds ₹1,00,000/);
  assert.equal(result.decisions.length, 4);
});
