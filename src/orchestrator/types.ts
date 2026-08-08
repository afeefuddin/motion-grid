import type { z } from "zod";
import type { AdapterProfile } from "../capabilities/adapter";
import type { CapabilityId } from "../contracts/capabilities";
import type { AdapterModeSchema } from "../contracts/enums";
import type {
  AdapterCandidateSchema,
  CampaignSpecSchema,
  PlanDataSchema,
  RankingWeightsSchema,
} from "../contracts/steps";

export type AdapterMode = z.output<typeof AdapterModeSchema>;
export type AdapterCandidate = z.output<typeof AdapterCandidateSchema>;
export type CampaignSpec = z.output<typeof CampaignSpecSchema>;
export type PlanData = z.output<typeof PlanDataSchema>;
export type RankingWeights = z.output<typeof RankingWeightsSchema>;

/** Adapter metadata consumed by deterministic ranking. */
export interface RankingAdapter {
  readonly id: string;
  readonly provides: readonly CapabilityId[];
  readonly mode: AdapterMode;
  readonly unitCost: {
    readonly unit: "request" | "record" | "message" | "impression";
    readonly operatingCents: number;
    readonly commitCents: number;
    readonly projected: boolean;
  };
  readonly profile: AdapterProfile;
}

/** Constraints that make an adapter eligible for a capability. */
export interface RankingRequest {
  readonly capabilityId: CapabilityId;
  readonly adapters: readonly RankingAdapter[];
  readonly weights: RankingWeights;
  readonly geography: string;
  readonly categories: readonly string[];
  readonly requiredThroughputPerMinute: number;
  readonly excludedAdapterIds?: readonly string[];
}

export type RankingResult =
  | { readonly ok: true; readonly candidates: readonly AdapterCandidate[] }
  | { readonly ok: false; readonly reason: string };

export interface RankingWeightProposal {
  readonly weights: {
    readonly cost: number;
    readonly freshness: number;
    readonly confidence: number;
    readonly coverage: number;
  };
  readonly weightsRationale: string;
}

export type OrchestratorResult =
  | { readonly ok: true; readonly data: PlanData }
  | { readonly ok: false; readonly reason: string };
