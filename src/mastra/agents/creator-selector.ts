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
    "Selects the most relevant creators for a campaign from a supplied candidate list.",
  model: midAgentModel,
  instructions: `Select the creators most relevant to the supplied campaign specification.
Use only the supplied candidate list. Prioritize content tags, audience geography, and audience interests that match the campaign's goal and target criteria. Then consider engagement quality, follower reach, commercial fit, brand-safety flags, and fake-follower estimate.
Return up to ten candidates, ordered from strongest to weakest. When at least ten candidates are relevant, return exactly ten. Every selected externalRef must come from the supplied list and every reason must name the matching tags or audience attributes. Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: CreatorShortlistDataSchema },
  },
});

export async function runCreatorSelector(
  input: unknown,
  agent: StructuredAgent<z.output<typeof CreatorShortlistDataSchema>> =
    creatorSelector,
) {
  const parsed = CreatorShortlistInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Select the most relevant creators:", parsed),
  );
  return CreatorShortlistOutputSchema.parse({ ok: true, data: result.object });
}
