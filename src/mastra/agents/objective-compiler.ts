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
When a budget is supplied, preserve its USD operating and INR commitment amounts exactly.
When no budget is supplied, infer both amounts from the objective's scale, geography, and selected motions.
Infer a concise campaign name, geography, target criteria, allowed channels, and a measurable success metric from the objective.
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
