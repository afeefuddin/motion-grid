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

function searchTerms(value: string, locality?: string): string[] {
  const localityTerms = new Set(
    locality === undefined
      ? []
      : locality.toLocaleLowerCase("en-IN").split(/[^a-z0-9]+/),
  );
  return value
    .toLocaleLowerCase("en-IN")
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !localityTerms.has(term))
    .map((term) =>
      term.length > 3 && term.endsWith("s") ? term.slice(0, -1) : term,
    );
}

export const marketGeoSimAdapter = {
  adapterId: "market.geo",
  capability: "geo.query",
  unitCost: unitCost("record", 0.3),
  profile: {
    coverage: {
      geographies: ["Bengaluru"],
      categories: [
        "salon & spa",
        "skin & derma clinic",
        "dental clinic",
        "boutique gym & yoga studio",
        "pet clinic",
        "speciality café",
      ],
    },
    freshnessDays: 0,
    expectedConfidence: 0.95,
    rateLimitPerMinute: null,
    writesExternalState: false,
    productionPath: "Outscraper, Google Places",
  },
  async execute(input: Input): Promise<Output> {
    await watchableDelay(input);
    const query = searchTerms(input.query, input.locality);
    const targets = simWorld.businesses
      .filter(
        (business) =>
          (input.locality === undefined ||
            business.locality
              .toLocaleLowerCase("en-IN")
              .includes(input.locality.toLocaleLowerCase("en-IN"))) &&
          query.length > 0 &&
          query.every((term) =>
            searchTerms(`${business.category} ${business.name}`).includes(term),
          ) &&
          (input.locality !== undefined ||
            distanceKm(
              { latitude: input.latitude, longitude: input.longitude },
              business.geo,
            ) <= input.radiusKm),
      )
      .slice(0, input.limit)
      .map(organizationTarget);
    return { targets };
  },
};
