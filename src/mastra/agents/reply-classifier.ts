import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import {
  ClassifyReplyDataSchema,
  ClassifyReplyInputSchema,
  ClassifyReplyOutputSchema,
} from "../../contracts/steps";
import { lightAgentModel } from "./models";
import { agentInput } from "./prompt";
import type { StructuredAgent } from "./runner";

export const replyClassifier = new Agent({
  id: "reply-classifier",
  name: "Reply Classifier",
  description:
    "Classifies an inbound reply into a deterministic downstream action.",
  model: lightAgentModel,
  instructions: `Classify the supplied inbound message conservatively.
Use opt_out with suppress when the sender asks to stop, unsubscribe, or not be contacted.
Use meeting_request with book_meeting only when the sender clearly requests or accepts scheduling.
Use review when meaning is unclear or confidence is low.
Return only the structured intent, sentiment, next action, and confidence.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: ClassifyReplyDataSchema },
  },
});

export async function runReplyClassifier(
  input: unknown,
  agent: StructuredAgent<
    z.output<typeof ClassifyReplyDataSchema>
  > = replyClassifier,
) {
  const parsed = ClassifyReplyInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Classify this inbound reply:", parsed),
  );
  return ClassifyReplyOutputSchema.parse({ ok: true, data: result.object });
}
