import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import {
  CreatorShortlistDataSchema,
  CreatorShortlistInputSchema,
  CreatorShortlistOutputSchema,
} from "../../contracts/steps";
import { midAgentModel } from "./models";
import { agentInput } from "./prompt";
import type { StructuredAgent } from "./runner";

export const creatorSelector = new Agent({
  id: "creator-selector",
  name: "Creator Selector",
  description:
    "Qualifies and ranks every creator in a supplied candidate list.",
  model: midAgentModel,
  instructions: `Qualify every supplied creator against the campaign specification.
Use only the supplied candidate list. A creator's profile.contentCategories are its content tags. Prioritize those tags, profile.audienceGeography, and profile.audienceInterests when matching the campaign goal and target criteria. Then consider engagement quality, follower reach, commercial fit, profile.brandSafetyFlags, and fake-follower estimate.
Return exactly one decision for every supplied candidate and copy every externalRef exactly. Set isFit independently for each creator; do not limit fit creators to an arbitrary shortlist size. Give every creator a relevance score and a concise reason naming the matching or mismatching tags, audience attributes, commercial constraints, or safety concern. Order decisions from strongest to weakest relevance. Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: CreatorShortlistDataSchema },
  },
});

export async function runCreatorSelector(
  input: unknown,
  agent: StructuredAgent<
    z.output<typeof CreatorShortlistDataSchema>
  > = creatorSelector,
) {
  const parsed = CreatorShortlistInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Qualify these creator candidates:", parsed),
  );
  return CreatorShortlistOutputSchema.parse({ ok: true, data: result.object });
}
