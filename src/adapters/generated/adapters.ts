import type { Adapter, AdapterProfile } from "../../capabilities/adapter";
import {
  DbQueryInputSchema,
  DbQueryOutputSchema,
  DbQueryUnitCostSchema,
  GeoQueryInputSchema,
  GeoQueryOutputSchema,
  GeoQueryUnitCostSchema,
  PeopleFindInputSchema,
  PeopleFindOutputSchema,
  PeopleFindUnitCostSchema,
  ReviewsFetchInputSchema,
  ReviewsFetchOutputSchema,
  ReviewsFetchUnitCostSchema,
  WebFetchInputSchema,
  WebFetchOutputSchema,
  WebFetchUnitCostSchema,
} from "../../contracts/capabilities";
import { organizationTarget } from "../sim/shared";
import { generateWorldWithClaude } from "./model";
import { GeneratedMarketStore } from "./store";

const profile: AdapterProfile = {
  coverage: { geographies: ["*"], categories: ["*"] },
  freshnessDays: 30,
  expectedConfidence: 0.62,
  rateLimitPerMinute: 10,
  writesExternalState: false,
  productionPath: "Outscraper, Google Places, Firecrawl, Apollo",
};

function queryParts(query: string): { geography: string; category: string } {
  const match = /^(.*?)\s+in\s+(.+)$/i.exec(query.trim());
  if (match === null) {
    return { geography: query.trim(), category: query.trim() };
  }
  const category = match.at(1);
  const geography = match.at(2);
  if (category === undefined || geography === undefined) {
    throw new Error("Generated-market query could not be parsed.");
  }
  return { category: category.trim(), geography: geography.trim() };
}

function sourceRef(kind: string, externalRef: string): string {
  return `generated:${kind}:${externalRef}`;
}

export const generatedMarketStore = new GeneratedMarketStore({
  generateWorld: generateWorldWithClaude,
});

/** Creates all generated-market capability adapters over one shared cache. */
export function createGeneratedMarketAdapters(
  store = generatedMarketStore,
) {
  const geo: Adapter<"geo.query"> = {
    id: "generated.market.geo",
    provides: ["geo.query"],
    mode: "generated",
    unitCost: GeoQueryUnitCostSchema.parse({
      unit: "record",
      operatingCents: 2,
      commitCents: 0,
      projected: true,
    }),
    profile,
    async execute(capabilityId, rawInput) {
      if (capabilityId !== "geo.query") {
        throw new Error(
          "Generated geo adapter received a different capability.",
        );
      }
      const input = GeoQueryInputSchema.parse(rawInput);
      const parts = queryParts(input.query);
      const world = await store.worldFor({
        ...parts,
        geography: input.locality ?? parts.geography,
        limit: input.limit,
        seed: 20260808,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      return GeoQueryOutputSchema.parse({
        targets: world.businesses.slice(0, input.limit).map(organizationTarget),
      });
    },
  };

  const db: Adapter<"db.query"> = {
    id: "generated.market.db",
    provides: ["db.query"],
    mode: "generated",
    unitCost: DbQueryUnitCostSchema.parse({
      unit: "record",
      operatingCents: 1,
      commitCents: 0,
      projected: true,
    }),
    profile,
    async execute(capabilityId, rawInput) {
      if (capabilityId !== "db.query") {
        throw new Error(
          "Generated database adapter received a different capability.",
        );
      }
      const input = DbQueryInputSchema.parse(rawInput);
      if (input.entityKind === "creator") {
        return DbQueryOutputSchema.parse({ targets: [] });
      }
      const world = await store.worldFor({
        geography: input.filters.locality ?? "global",
        category: input.filters.category ?? "company",
        limit: input.limit,
        seed: 20260808,
        latitude: 0,
        longitude: 0,
      });
      return DbQueryOutputSchema.parse({
        targets: world.businesses.slice(0, input.limit).map(organizationTarget),
      });
    },
  };

  const web: Adapter<"web.fetch"> = {
    id: "generated.market.web",
    provides: ["web.fetch"],
    mode: "generated",
    unitCost: WebFetchUnitCostSchema.parse({
      unit: "request",
      operatingCents: 0,
      commitCents: 0,
      projected: true,
    }),
    profile,
    async execute(capabilityId, rawInput) {
      if (capabilityId !== "web.fetch") {
        throw new Error(
          "Generated web adapter received a different capability.",
        );
      }
      const input = WebFetchInputSchema.parse(rawInput);
      const business = await store.findBusiness(input.externalRef);
      return WebFetchOutputSchema.parse({
        sourceRef: sourceRef("web", input.externalRef),
        url: input.url,
        contentType: "text/html; charset=utf-8",
        content: business === null ? "" : business.website.html,
        fetchedAt:
          business === null
            ? "2026-08-08T00:00:00.000Z"
            : business.website.capturedAt,
      });
    },
  };

  const reviews: Adapter<"reviews.fetch"> = {
    id: "generated.market.reviews",
    provides: ["reviews.fetch"],
    mode: "generated",
    unitCost: ReviewsFetchUnitCostSchema.parse({
      unit: "record",
      operatingCents: 0,
      commitCents: 0,
      projected: true,
    }),
    profile,
    async execute(capabilityId, rawInput) {
      if (capabilityId !== "reviews.fetch") {
        throw new Error(
          "Generated reviews adapter received a different capability.",
        );
      }
      const input = ReviewsFetchInputSchema.parse(rawInput);
      const business = await store.findBusiness(input.externalRef);
      const artifacts = business === null ? [] : [...business.reviews];
      artifacts.sort(
        (left, right) =>
          left.rating - right.rating ||
          left.occurredAt.localeCompare(right.occurredAt),
      );
      return ReviewsFetchOutputSchema.parse({
        sourceRef: sourceRef("reviews", input.externalRef),
        reviews: artifacts.slice(0, input.limit),
      });
    },
  };

  const people: Adapter<"people.find"> = {
    id: "generated.market.people",
    provides: ["people.find"],
    mode: "generated",
    unitCost: PeopleFindUnitCostSchema.parse({
      unit: "record",
      operatingCents: 1.5,
      commitCents: 0,
      projected: true,
    }),
    profile,
    async execute(capabilityId, rawInput) {
      if (capabilityId !== "people.find") {
        throw new Error(
          "Generated people adapter received a different capability.",
        );
      }
      const input = PeopleFindInputSchema.parse(rawInput);
      const business = await store.findBusiness(input.externalRef);
      return PeopleFindOutputSchema.parse({
        people:
          business === null
            ? []
            : business.contacts.map((contact) => ({
                name: contact.name,
                role: contact.role,
                email: input.channels.includes("email") ? contact.email : null,
                phone: input.channels.includes("whatsapp")
                  ? contact.phone
                  : null,
                confidence: contact.role === "Owner" ? 0.68 : 0.58,
              })),
      });
    },
  };

  return { geo, db, web, reviews, people };
}

const generatedMarketAdapters = createGeneratedMarketAdapters();
export const generatedMarketGeoAdapter = generatedMarketAdapters.geo;
export const generatedMarketDbAdapter = generatedMarketAdapters.db;
export const generatedMarketWebAdapter = generatedMarketAdapters.web;
export const generatedMarketReviewsAdapter = generatedMarketAdapters.reviews;
export const generatedMarketPeopleAdapter = generatedMarketAdapters.people;
