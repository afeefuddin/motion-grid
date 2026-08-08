import type { z } from "zod";
import type { NewSignalSchema } from "../contracts/entities";
import type {
  ExtractedEvidenceSchema,
  SourceDocumentSchema,
} from "../contracts/steps";

type ExtractedEvidence = z.output<typeof ExtractedEvidenceSchema>;
type SourceDocument = z.output<typeof SourceDocumentSchema>;
type NewSignal = z.input<typeof NewSignalSchema>;

export interface EvidenceContext {
  readonly campaignId: string;
  readonly targetId: string;
  readonly runId: string;
}

export interface VerifiedEvidence {
  readonly signals: NewSignal[];
  readonly droppedCount: number;
}

/** Normalizes documentary text without changing punctuation or word order. */
export function normalizeEvidence(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function sourceText(document: SourceDocument): string {
  if (document.kind === "web") {
    return document.document.content;
  }
  return document.reviews.map((review) => review.text).join("\n");
}

function verifiesDocumentarySignal(
  evidence: ExtractedEvidence & { evidenceKind: "documentary" },
  documents: readonly SourceDocument[],
): boolean {
  const document = documents.find((candidate) =>
    candidate.kind === "web"
      ? candidate.document.sourceRef === evidence.payload.sourceRef
      : candidate.sourceRef === evidence.payload.sourceRef,
  );
  return (
    document !== undefined &&
    normalizeEvidence(sourceText(document)).includes(
      normalizeEvidence(evidence.payload.excerpt),
    )
  );
}

/**
 * Converts extracted evidence into persistable signals.
 *
 * Documentary evidence is retained only when its normalized excerpt occurs in
 * the source identified by sourceRef. Statistical evidence already carries its
 * derivation fields and is retained unchanged.
 */
export function verifyEvidence(
  context: EvidenceContext,
  documents: readonly SourceDocument[],
  extracted: readonly ExtractedEvidence[],
): VerifiedEvidence {
  const signals: NewSignal[] = [];
  let droppedCount = 0;

  for (const evidence of extracted) {
    if (evidence.evidenceKind === "documentary") {
      if (!verifiesDocumentarySignal(evidence, documents)) {
        droppedCount += 1;
        continue;
      }
      signals.push({
        ...context,
        evidenceKind: "documentary",
        payload: { ...evidence.payload, verified: true },
      });
      continue;
    }
    signals.push({ ...context, ...evidence });
  }

  return { signals, droppedCount };
}
