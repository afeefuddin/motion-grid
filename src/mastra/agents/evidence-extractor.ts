import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import {
  ExtractEvidenceDataSchema,
  ExtractEvidenceInputSchema,
  ExtractEvidenceOutputSchema,
} from "../../contracts/steps";
import { midAgentModel } from "./models";
import { agentInput } from "./prompt";
import type { StructuredAgent } from "./runner";

export const evidenceExtractor = new Agent({
  id: "evidence-extractor",
  name: "Evidence Extractor",
  description:
    "Extracts source-grounded qualification signals from observed artifacts.",
  model: midAgentModel,
  instructions: `Extract qualification signals from the supplied source documents.
Every documentary excerpt must be copied verbatim from its source and must retain that sourceRef.
Never paraphrase an excerpt and never create a fact that is absent from the documents.
Set verified false because deterministic verification happens after extraction.
Aim for at least three useful signals from at least two distinct sources when the documents support them.
If the evidence is insufficient, return fewer signals instead of fabricating evidence.
Use statistical evidence only when the document explicitly supplies the metric, value, baseline, method, and window.
Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: ExtractEvidenceDataSchema },
  },
});

export async function runEvidenceExtractor(
  input: unknown,
  agent: StructuredAgent<
    z.output<typeof ExtractEvidenceDataSchema>
  > = evidenceExtractor,
) {
  const parsed = ExtractEvidenceInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Extract evidence from these documents:", parsed),
  );
  return ExtractEvidenceOutputSchema.parse({ ok: true, data: result.object });
}
