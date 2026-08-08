import type { z } from "zod";
import type {
  GeoQueryInputSchema,
  GeoQueryOutputSchema,
} from "../../contracts/capabilities";
import { simWorld } from "../../sim/world";
import {
  distanceKm,
  organizationTarget,
  unitCost,
  watchableDelay,
} from "./shared";

type Input = z.infer<typeof GeoQueryInputSchema>;
type Output = z.infer<typeof GeoQueryOutputSchema>;

function searchTerms(value: string): string[] {
  return value
    .toLocaleLowerCase("en-IN")
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && term !== "bengaluru")
    .map((term) =>
      term.length > 3 && term.endsWith("s") ? term.slice(0, -1) : term,
    );
}

export const marketGeoSimAdapter = {
  adapterId: "market.geo",
  capability: "geo.query",
  unitCost: unitCost("record", 0.3),
  async execute(input: Input): Promise<Output> {
    await watchableDelay(input);
    const query = searchTerms(input.query);
    const targets = simWorld.businesses
      .filter(
        (business) =>
          query.length > 0 &&
          query.every((term) =>
            searchTerms(`${business.category} ${business.name}`).includes(term),
          ) &&
          distanceKm(
            { latitude: input.latitude, longitude: input.longitude },
            business.geo,
          ) <= input.radiusKm,
      )
      .slice(0, input.limit)
      .map(organizationTarget);
    return { targets };
  },
};
