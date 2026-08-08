import type { z } from "zod";
import type {
  DbQueryInputSchema,
  DbQueryOutputSchema,
} from "../../contracts/capabilities";
import { simWorld } from "../../sim/world";
import {
  organizationTarget,
  personTarget,
  unitCost,
  watchableDelay,
} from "./shared";

type Input = z.infer<typeof DbQueryInputSchema>;
type Output = z.infer<typeof DbQueryOutputSchema>;

function includesValue(values: string[], filter: string | undefined): boolean {
  return filter === undefined
    ? true
    : values.some((value) =>
        value
          .toLocaleLowerCase("en-IN")
          .includes(filter.toLocaleLowerCase("en-IN")),
      );
}

export const indexDbSimAdapter = {
  adapterId: "index.db",
  capability: "db.query",
  unitCost: unitCost("record", 0.2),
  async execute(input: Input): Promise<Output> {
    await watchableDelay(input);
    if (input.entityKind === "company") {
      const targets = simWorld.businesses
        .filter(
          (business) =>
            includesValue([business.category], input.filters.category) &&
            includesValue([business.locality], input.filters.locality),
        )
        .slice(0, input.limit)
        .map(organizationTarget);
      return { targets };
    }

    const targets = simWorld.creators
      .filter(
        (creator) =>
          includesValue(creator.contentCategories, input.filters.category) &&
          includesValue(
            Object.keys(creator.audience.geography),
            input.filters.locality,
          ) &&
          (input.filters.minimumFollowers === undefined ||
            creator.followers >= input.filters.minimumFollowers) &&
          (input.filters.maximumCommitCents === undefined ||
            creator.rateCard.reel.amountPaise <=
              input.filters.maximumCommitCents),
      )
      .slice(0, input.limit)
      .map(personTarget);
    return { targets };
  },
};
