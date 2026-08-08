import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import {
  CampaignSpecSchema,
  CompileObjectiveInputSchema,
  CompileObjectiveOutputSchema,
} from "../../contracts/steps";
import { heavyAgentModel } from "./models";
import { agentInput } from "./prompt";
import type { StructuredAgent } from "./runner";

export const objectiveCompiler = new Agent({
  id: "objective-compiler",
  name: "Objective Compiler",
  description:
    "Compiles a campaign objective into the frozen campaign specification.",
  model: heavyAgentModel,
  instructions: `Compile the supplied objective into a precise campaign specification.
Choose only creator, business.local, business.online, consumer.ads, or consumer.email motions.
Infer a concise campaign name, geography, target criteria, allowed channels, and a measurable success metric from the objective.
Do not infer, request, or return campaign budgets, spend limits, or monetary allocations.
Distinguish the company, brand, product, or service being promoted from the audience that could buy it. A named brand in the objective is the seller or offer unless the objective explicitly asks to target that brand or its competitors.
When the requested clients are organizations, choose business.local for place-based prospects and business.online for non-local companies. These are prospective customers even though the motion name starts with business. Use consumer.ads only to build an advertising audience from connected first-party customer data, and consumer.email only to contact existing opted-in customers. Never use a consumer motion for cold business prospecting.
For business.local and business.online, set discoveryQuery to a concise category for the prospective customer account (for example, "corporate office" for a restaurant's office-catering offer or "dental clinic" for dental software). Never use the seller's own category, brand name, close substitutes, or competitors as discoveryQuery unless those businesses are explicitly the intended buyers. Do not put qualifying pain, conversion, reachability, geography, or provider-search terms in discoveryQuery; keep those in targetCriteria. Target criteria must describe why the discovered account could need and buy the promoted offer. Omit discoveryQuery when no organization motion is selected.
When creator is selected, include a creator audience or content taxonomy in targetCriteria (for example, "beauty creators") so profile qualification can evaluate audience fit without inferring a category from a business term.
Do not add a motion or channel without support in the objective. Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: CampaignSpecSchema },
  },
});

export async function runObjectiveCompiler(
  input: unknown,
  agent: StructuredAgent<
    z.output<typeof CampaignSpecSchema>
  > = objectiveCompiler,
) {
  const parsed = CompileObjectiveInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Compile this objective:", parsed),
  );
  return CompileObjectiveOutputSchema.parse({ ok: true, data: result.object });
}
