import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import {
  PlanDataSchema,
  PlanInputSchema,
  PlanOutputSchema,
} from "../../contracts/steps";
import { heavyAgentModel } from "./models";
import { agentInput } from "./prompt";
import type { StructuredAgent } from "./runner";

export const planner = new Agent({
  id: "planner",
  name: "Campaign Planner",
  description:
    "Builds a typed motion plan from a compiled campaign specification.",
  model: heavyAgentModel,
  instructions: `Create an auditable campaign plan from the supplied specification.
Use only these capability IDs: geo.query, db.query, web.fetch, reviews.fetch, people.find, segment.build, message.send, ads.plan.
Match each motion to registered capabilities; never invent a capability or vendor.
Keep USD operating cents separate from INR commitment paise and keep both totals within the supplied budgets.
Use dependsOn only when one declared motion truly requires another motion's result.
State policy requirements for outbound approval, consent, suppression, budget, and rate limits when relevant.
Add practical human-led suggestions when they complement executable capabilities, such as trusted introductions, trackable flyers, community partnerships, or a focused door-to-door route. Keep these in suggestedActions and never represent them as tool capabilities or automated work.
Return only the structured result and preserve the supplied campaign ID.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: PlanDataSchema },
  },
});

export async function runPlanner(
  input: unknown,
  agent: StructuredAgent<z.output<typeof PlanDataSchema>> = planner,
) {
  const parsed = PlanInputSchema.parse(input);
  const result = await agent.generate(
    agentInput("Plan this campaign:", parsed),
  );
  return PlanOutputSchema.parse({ ok: true, data: result.object });
}
