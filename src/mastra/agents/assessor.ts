import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import {
  AssessDataSchema,
  AssessInputSchema,
  AssessOutputSchema,
} from "../../contracts/steps";
import { midAgentModel } from "./models";
import { agentInput } from "./prompt";
import type { StructuredAgent } from "./runner";

export const assessor = new Agent({
  id: "assessor",
  name: "Signal Assessor",
  description:
    "Evaluates verified signals against a motion qualification rubric.",
  model: midAgentModel,
  instructions: `Assess target fit using only the supplied signals and rubric.
Do not request, infer from, or refer to raw pages or source documents.
Missing evidence increases uncertainty and never contributes positive evidence.
Account for droppedCount when setting confidence and explaining the result.
The status must agree with isFit: fit for true and not_fit for false.
Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: AssessDataSchema },
  },
});

export async function runAssessor(
  input: unknown,
  agent: StructuredAgent<z.output<typeof AssessDataSchema>> = assessor,
) {
  const parsed = AssessInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Assess this target:", parsed),
  );
  return AssessOutputSchema.parse({ ok: true, data: result.object });
}
