import assert from "node:assert/strict";
import test from "node:test";
import { verifyEvidence } from "./verify";

const context = {
  campaignId: "ef08bd1f-c238-4bed-9b2d-05a737d0f8e4",
  targetId: "6ce87ed0-22d6-4fd5-a34d-2f043919b5a0",
  runId: "b4a79be8-527a-410b-bb87-c9b76a796003",
};

test("verifies excerpts against only their identified source", () => {
  const result = verifyEvidence(
    context,
    [
      {
        kind: "web",
        document: {
          sourceRef: "sim:web:one",
          url: "https://one.example/",
          contentType: "text/html",
          content: "Book   appointments ONLINE today.",
          fetchedAt: "2026-08-08T00:00:00.000Z",
        },
      },
      {
        kind: "reviews",
        sourceRef: "sim:reviews:one",
        reviews: [
          {
            id: "review-1",
            rating: 2,
            text: "Nobody answered the phone.",
            occurredAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
    ],
    [
      {
        evidenceKind: "documentary",
        payload: {
          sourceRef: "sim:web:one",
          excerpt: "book appointments online",
          verified: false,
          implication: "Online booking exists.",
          strength: 0.9,
        },
      },
      {
        evidenceKind: "documentary",
        payload: {
          sourceRef: "sim:web:one",
          excerpt: "Nobody answered the phone.",
          verified: false,
          implication: "Calls go unanswered.",
          strength: 0.8,
        },
      },
    ],
  );

  assert.equal(result.droppedCount, 1);
  assert.equal(result.signals.length, 1);
  const signal = result.signals[0];
  assert.equal(signal?.evidenceKind, "documentary");
  if (signal?.evidenceKind === "documentary") {
    assert.equal(signal.payload.verified, true);
  }
});
