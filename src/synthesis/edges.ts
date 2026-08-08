import type { Business, Creator } from "../sim/schema";

const COMMON_SUFFIXES = new Set([
  "salon",
  "spa",
  "clinic",
  "studio",
  "pvt",
  "ltd",
]);

function words(value: string): string[] {
  return value
    .toLocaleLowerCase("en-IN")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/** Normalises names and captions before deterministic mention matching. */
export function normalizeMentionText(value: string): string {
  return words(value)
    .filter((word) => !COMMON_SUFFIXES.has(word))
    .join(" ");
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const cell = (row: readonly number[], index: number): number => {
    const value = row.at(index);
    if (value === undefined) {
      throw new Error("Mention edit-distance matrix is incomplete.");
    }
    return value;
  };

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        left.charAt(leftIndex - 1) === right.charAt(rightIndex - 1) ? 0 : 1;
      current[rightIndex] = Math.min(
        cell(current, rightIndex - 1) + 1,
        cell(previous, rightIndex) + 1,
        cell(previous, rightIndex - 1) + substitution,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return cell(previous, right.length);
}

function similarity(left: string, right: string): number {
  return 1 - editDistance(left, right) / Math.max(left.length, right.length);
}

function matchConfidence(
  business: Pick<Business, "name" | "locality">,
  caption: string,
): number | null {
  const captionWords = words(caption);
  if (captionWords.length === 0) {
    return null;
  }
  const localityWords = new Set(words(business.locality));
  const nameWords = words(business.name).filter(
    (word) =>
      !COMMON_SUFFIXES.has(word) &&
      !localityWords.has(word) &&
      word.length >= 4,
  );
  if (nameWords.length === 0) {
    return null;
  }

  const exactName = words(business.name).join(" ");
  const exactCaption = words(caption).join(" ");
  if (exactCaption.includes(exactName)) {
    return 0.99;
  }

  const scores = nameWords.map((nameWord) =>
    Math.max(
      ...captionWords.map((captionWord) => similarity(nameWord, captionWord)),
    ),
  );
  if (scores.some((score) => score < 0.86)) {
    return null;
  }

  const average =
    scores.reduce((total, score) => total + score, 0) / scores.length;
  return Math.min(0.95, Number((0.82 + average * 0.13).toFixed(4)));
}

export interface MentionEdge {
  readonly creatorExternalRef: string;
  readonly businessExternalRef: string;
  readonly confidence: number;
  readonly evidence: string;
  readonly postExternalRef: string;
}

/**
 * Finds creator posts that mention businesses in the supplied campaign set.
 *
 * The returned caption is evidence, while confidence reflects only name-match quality.
 */
export function discoverMentionEdges(
  creators: readonly Creator[],
  businesses: readonly Business[],
): MentionEdge[] {
  const edges: MentionEdge[] = [];

  for (const creator of creators) {
    for (const post of creator.posts) {
      for (const business of businesses) {
        const confidence = matchConfidence(business, post.caption);
        if (confidence !== null) {
          edges.push({
            creatorExternalRef: creator.id,
            businessExternalRef: business.id,
            confidence,
            evidence: post.caption,
            postExternalRef: post.id,
          });
        }
      }
    }
  }

  return edges.sort(
    (left, right) =>
      left.creatorExternalRef.localeCompare(right.creatorExternalRef) ||
      left.businessExternalRef.localeCompare(right.businessExternalRef),
  );
}
