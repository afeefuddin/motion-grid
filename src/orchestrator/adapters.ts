import {
  cohortSegmentSimAdapter,
  indexDbSimAdapter,
  marketGeoSimAdapter,
  marketPeopleSimAdapter,
  marketReviewsSimAdapter,
  marketWebSimAdapter,
} from "../adapters/sim";
import type { CapabilityId } from "../contracts/capabilities";
import type { RankingAdapter } from "./types";

function simulationAdapter(
  id: string,
  capabilityId: CapabilityId,
  unitCost: RankingAdapter["unitCost"],
  profile: RankingAdapter["profile"],
): RankingAdapter {
  return {
    id,
    provides: [capabilityId],
    mode: "sim",
    unitCost,
    profile,
  };
}

/** Metadata for the simulation adapters currently connected to the workspace. */
export const defaultRankingAdapters: readonly RankingAdapter[] = [
  simulationAdapter(
    marketGeoSimAdapter.adapterId,
    "geo.query",
    marketGeoSimAdapter.unitCost,
    marketGeoSimAdapter.profile,
  ),
  simulationAdapter(
    indexDbSimAdapter.adapterId,
    "db.query",
    indexDbSimAdapter.unitCost,
    indexDbSimAdapter.profile,
  ),
  simulationAdapter(
    marketWebSimAdapter.adapterId,
    "web.fetch",
    marketWebSimAdapter.unitCost,
    marketWebSimAdapter.profile,
  ),
  simulationAdapter(
    marketReviewsSimAdapter.adapterId,
    "reviews.fetch",
    marketReviewsSimAdapter.unitCost,
    marketReviewsSimAdapter.profile,
  ),
  simulationAdapter(
    marketPeopleSimAdapter.adapterId,
    "people.find",
    marketPeopleSimAdapter.unitCost,
    marketPeopleSimAdapter.profile,
  ),
  simulationAdapter(
    cohortSegmentSimAdapter.adapterId,
    "segment.build",
    cohortSegmentSimAdapter.unitCost,
    cohortSegmentSimAdapter.profile,
  ),
];
