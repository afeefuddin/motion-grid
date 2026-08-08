import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import {
  DraftDataSchema,
  DraftInputSchema,
  DraftOutputSchema,
} from "../../contracts/steps";
import { midAgentModel } from "./models";
import { agentInput } from "./prompt";
import type { StructuredAgent } from "./runner";

export const drafter = new Agent({
  id: "drafter",
  name: "Evidence-Grounded Drafter",
  description:
    "Drafts one channel-native outreach message grounded sentence by sentence.",
  model: midAgentModel,
  instructions: `Draft one sales outreach message for the supplied channel, contact, workspace, campaign goal, prospective-customer criteria, and verified signals.
Present the workspace's offer to the prospect described by the campaign goal; do not write as though the prospect is a competitor, partner, or consumer unless the campaign explicitly says so.
Every sentence must contain exactly one evidenceId from the supplied signals. Every factual claim about the prospect must be supported by that signal; the supplied workspace name and campaign goal are approved campaign context.
For WhatsApp, write a short direct message with a null subject and no signature block.
For email, provide a concise subject and a compact message body split into natural sentences.
Do not introduce unsupported claims, invented familiarity, or promises.
Preserve the requested channel and return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: DraftDataSchema },
  },
});

export async function runDrafter(
  input: unknown,
  agent: StructuredAgent<z.output<typeof DraftDataSchema>> = drafter,
) {
  const parsed = DraftInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Draft this message:", parsed),
  );
  return DraftOutputSchema.parse({ ok: true, data: result.object });
}
