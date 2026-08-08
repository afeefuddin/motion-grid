import {
  generatedMarketDbAdapter,
  generatedMarketGeoAdapter,
  generatedMarketPeopleAdapter,
  generatedMarketReviewsAdapter,
  generatedMarketWebAdapter,
} from "../adapters/generated";
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

function generatedAdapter(
  adapter:
    | typeof generatedMarketDbAdapter
    | typeof generatedMarketGeoAdapter
    | typeof generatedMarketPeopleAdapter
    | typeof generatedMarketReviewsAdapter
    | typeof generatedMarketWebAdapter,
): RankingAdapter {
  return {
    id: adapter.id,
    provides: adapter.provides,
    mode: "generated",
    unitCost: adapter.unitCost,
    profile: adapter.profile,
  };
}

/** Metadata for the simulation and generated adapters available to ranking. */
export const defaultRankingAdapters: readonly RankingAdapter[] = [
  simulationAdapter(
    marketGeoSimAdapter.adapterId,
    "geo.query",
    marketGeoSimAdapter.unitCost,
    marketGeoSimAdapter.profile,
  ),
  generatedAdapter(generatedMarketGeoAdapter),
  simulationAdapter(
    indexDbSimAdapter.adapterId,
    "db.query",
    indexDbSimAdapter.unitCost,
    indexDbSimAdapter.profile,
  ),
  generatedAdapter(generatedMarketDbAdapter),
  generatedAdapter(generatedMarketWebAdapter),
  simulationAdapter(
    marketWebSimAdapter.adapterId,
    "web.fetch",
    marketWebSimAdapter.unitCost,
    marketWebSimAdapter.profile,
  ),
  generatedAdapter(generatedMarketReviewsAdapter),
  simulationAdapter(
    marketReviewsSimAdapter.adapterId,
    "reviews.fetch",
    marketReviewsSimAdapter.unitCost,
    marketReviewsSimAdapter.profile,
  ),
  generatedAdapter(generatedMarketPeopleAdapter),
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
