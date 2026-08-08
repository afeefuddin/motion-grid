import type { z } from "zod";
import type {
  ReviewsFetchInputSchema,
  ReviewsFetchOutputSchema,
} from "../../contracts/capabilities";
import { simWorld } from "../../sim/world";
import { unitCost, watchableDelay } from "./shared";

type Input = z.infer<typeof ReviewsFetchInputSchema>;
type Output = z.infer<typeof ReviewsFetchOutputSchema>;

export const marketReviewsSimAdapter = {
  adapterId: "market.reviews",
  capability: "reviews.fetch",
  unitCost: unitCost("record", 0),
  async execute(input: Input): Promise<Output> {
    await watchableDelay(input);
    const business = simWorld.businesses.find(
      (candidate) => candidate.id === input.externalRef,
    );
    const reviews = business === undefined ? [] : [...business.reviews];
    reviews.sort(
      (left, right) =>
        left.rating - right.rating ||
        left.occurredAt.localeCompare(right.occurredAt),
    );
    return {
      sourceRef: `sim:reviews:${input.externalRef}`,
      reviews: reviews.slice(0, input.limit),
    };
  },
};
