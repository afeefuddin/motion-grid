import type { Adapter } from "../../capabilities/adapter";
import {
  generatedMarketGeoAdapter,
  generatedMarketStore,
} from "../generated";
import { marketBusinessRepo } from "../../db/repositories";
import {
  marketGeoSimAdapter,
  marketPeopleSimAdapter,
  marketReviewsSimAdapter,
  marketWebSimAdapter,
} from "../sim";
import { organizationTarget } from "../sim/shared";
import { catalogProfile } from "./profile";

export const marketGeoCatalogAdapter: Adapter<"geo.query"> = {
  id: marketGeoSimAdapter.adapterId,
  provides: ["geo.query"],
  mode: "sim",
  unitCost: { ...marketGeoSimAdapter.unitCost, unit: "record" },
  profile: catalogProfile(marketGeoSimAdapter.profile),
  async execute() {
    const businesses = await marketBusinessRepo.all();
    return { targets: businesses.map(organizationTarget) };
  },
};

export const marketWebCatalogAdapter: Adapter<"web.fetch"> = {
  id: marketWebSimAdapter.adapterId,
  provides: ["web.fetch"],
  mode: "sim",
  unitCost: { ...marketWebSimAdapter.unitCost, unit: "request" },
  profile: catalogProfile(marketWebSimAdapter.profile),
  async execute(_capabilityId, input) {
    const business = await marketBusinessRepo.find(input.externalRef);
    return {
      sourceRef: `catalog:web:${input.externalRef}`,
      url: input.url,
      contentType: "text/html; charset=utf-8",
      content: business?.website.html ?? "",
      fetchedAt: business?.website.capturedAt ?? new Date().toISOString(),
    };
  },
};

export const marketReviewsCatalogAdapter: Adapter<"reviews.fetch"> = {
  id: marketReviewsSimAdapter.adapterId,
  provides: ["reviews.fetch"],
  mode: "sim",
  unitCost: { ...marketReviewsSimAdapter.unitCost, unit: "record" },
  profile: catalogProfile(marketReviewsSimAdapter.profile),
  async execute(_capabilityId, input) {
    const business = await marketBusinessRepo.find(input.externalRef);
    const reviews = business === null ? [] : [...business.reviews];
    reviews.sort(
      (left, right) =>
        left.rating - right.rating ||
        left.occurredAt.localeCompare(right.occurredAt),
    );
    return {
      sourceRef: `catalog:reviews:${input.externalRef}`,
      reviews: reviews.slice(0, input.limit),
    };
  },
};

export const marketPeopleCatalogAdapter: Adapter<"people.find"> = {
  id: marketPeopleSimAdapter.adapterId,
  provides: ["people.find"],
  mode: "sim",
  unitCost: { ...marketPeopleSimAdapter.unitCost, unit: "record" },
  profile: catalogProfile(marketPeopleSimAdapter.profile),
  async execute(_capabilityId, input) {
    const business = await marketBusinessRepo.find(input.externalRef);
    return {
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
              confidence: contact.role === "Owner" ? 0.94 : 0.86,
            })),
    };
  },
};

/** Generates a market on catalog miss and materializes it before returning targets. */
export const generatedMarketGeoCatalogAdapter: Adapter<"geo.query"> = {
  ...generatedMarketGeoAdapter,
  async execute(capabilityId, input) {
    const output = await generatedMarketGeoAdapter.execute(
      capabilityId,
      input,
    );
    const businesses = await Promise.all(
      output.targets.map((target) =>
        generatedMarketStore.findBusiness(target.externalRef),
      ),
    );
    await marketBusinessRepo.upsert(
      businesses.filter((business) => business !== null),
      {
        geography:
          input.locality ?? input.query,
        provenance: "generated",
      },
    );
    return output;
  },
};
