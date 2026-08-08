import {
  cohortSegmentSimAdapter,
  indexDbSimAdapter,
  marketGeoSimAdapter,
  marketPeopleSimAdapter,
  marketReviewsSimAdapter,
  marketWebSimAdapter,
} from "../../adapters/sim";
import type { Adapter } from "../../capabilities/adapter";

// T2 predates the final Adapter interface. These wrappers are the only compatibility
// boundary; workflow code beyond this point sees the T3 contract exclusively.
export const geoSimAdapter: Adapter<"geo.query"> = {
  id: marketGeoSimAdapter.adapterId,
  provides: ["geo.query"],
  mode: "sim",
  unitCost: { ...marketGeoSimAdapter.unitCost, unit: "record" },
  profile: marketGeoSimAdapter.profile,
  execute(_capabilityId, input) {
    return marketGeoSimAdapter.execute(input);
  },
};

export const dbSimAdapter: Adapter<"db.query"> = {
  id: indexDbSimAdapter.adapterId,
  provides: ["db.query"],
  mode: "sim",
  unitCost: { ...indexDbSimAdapter.unitCost, unit: "record" },
  profile: indexDbSimAdapter.profile,
  execute(_capabilityId, input) {
    return indexDbSimAdapter.execute(input);
  },
};

export const webSimAdapter: Adapter<"web.fetch"> = {
  id: marketWebSimAdapter.adapterId,
  provides: ["web.fetch"],
  mode: "sim",
  unitCost: { ...marketWebSimAdapter.unitCost, unit: "request" },
  profile: marketWebSimAdapter.profile,
  execute(_capabilityId, input) {
    return marketWebSimAdapter.execute(input);
  },
};

export const reviewsSimAdapter: Adapter<"reviews.fetch"> = {
  id: marketReviewsSimAdapter.adapterId,
  provides: ["reviews.fetch"],
  mode: "sim",
  unitCost: { ...marketReviewsSimAdapter.unitCost, unit: "record" },
  profile: marketReviewsSimAdapter.profile,
  execute(_capabilityId, input) {
    return marketReviewsSimAdapter.execute(input);
  },
};

export const peopleSimAdapter: Adapter<"people.find"> = {
  id: marketPeopleSimAdapter.adapterId,
  provides: ["people.find"],
  mode: "sim",
  unitCost: { ...marketPeopleSimAdapter.unitCost, unit: "record" },
  profile: marketPeopleSimAdapter.profile,
  execute(_capabilityId, input) {
    return marketPeopleSimAdapter.execute(input);
  },
};

export const segmentSimAdapter: Adapter<"segment.build"> = {
  id: cohortSegmentSimAdapter.adapterId,
  provides: ["segment.build"],
  mode: "sim",
  unitCost: { ...cohortSegmentSimAdapter.unitCost, unit: "request" },
  profile: cohortSegmentSimAdapter.profile,
  execute(_capabilityId, input) {
    return cohortSegmentSimAdapter.execute(input);
  },
};
