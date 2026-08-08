import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { RankingWeightsSchema } from "../contracts/steps";
import { midAgentModel } from "../mastra/agents/models";
import { agentInput } from "../mastra/agents/prompt";
import type { StructuredAgent } from "../mastra/agents/runner";
import type {
  CampaignSpec,
  RankingWeightProposal,
  RankingWeights,
} from "./types";

const UnvalidatedWeightsSchema = z.object({
  cost: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  coverage: z.number().min(0).max(1),
});

export const RankingWeightProposalSchema = z.object({
  weights: UnvalidatedWeightsSchema,
  weightsRationale: z.string().min(1),
});

export const rankingWeightsAgent = new Agent({
  id: "ranking-weights",
  name: "Ranking Weights",
  description:
    "Derives adapter-ranking priorities without selecting an adapter.",
  model: midAgentModel,
  instructions: `Derive four adapter-ranking weights from the campaign specification.
Return cost, freshness, confidence, and coverage values between zero and one that sum exactly to one, plus one sentence explaining the priorities.
A tight operating budget increases cost. Recency language increases freshness. A named locality or narrow category increases coverage. High-stakes claims increase confidence.
Never name, recommend, or select an adapter. Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: RankingWeightProposalSchema },
  },
});

export type WeightResult =
  | {
      readonly ok: true;
      readonly weights: RankingWeights;
      readonly weightsRationale: string;
    }
  | { readonly ok: false; readonly reason: string };

/** Requests weights and retries once when their sum violates the frozen contract. */
export async function deriveRankingWeights(
  spec: CampaignSpec,
  agent: StructuredAgent<RankingWeightProposal> = rankingWeightsAgent,
): Promise<WeightResult> {
  let lastReason = "The ranking-weight response was malformed.";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await agent.generate(
      agentInput(
        attempt === 1
          ? "Set adapter-ranking priorities for this campaign:"
          : `Retry because the prior weights were rejected: ${lastReason}`,
        spec,
      ),
    );
    const proposal = RankingWeightProposalSchema.safeParse(result.object);
    if (!proposal.success) {
      lastReason = proposal.error.issues
        .map((issue) => issue.message)
        .join("; ");
      continue;
    }
    const weights = RankingWeightsSchema.safeParse(proposal.data.weights);
    if (!weights.success) {
      lastReason = weights.error.issues
        .map((issue) => issue.message)
        .join("; ");
      continue;
    }
    return {
      ok: true,
      weights: weights.data,
      weightsRationale: proposal.data.weightsRationale,
    };
  }
  return {
    ok: false,
    reason: `Ranking weights were rejected after two attempts: ${lastReason}`,
  };
}
