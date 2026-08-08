import { Agent } from "@mastra/core/agent";
import type { z } from "zod";
import { LocationFinderDataSchema } from "../../contracts/steps";
import { midAgentModel } from "./models";
import type { StructuredAgent } from "./runner";

export type LocationFinderData = z.output<typeof LocationFinderDataSchema>;

export const locationFinder = new Agent({
  id: "location-finder",
  name: "Location Finder",
  description:
    "Chooses relevant and contactable prospective customers from an available local business catalog.",
  model: midAgentModel,
  instructions: `Choose local businesses that are plausible prospective customers for the campaign's offer and that the campaign can realistically contact.
Use the campaign goal, prospective-customer category, geography, target criteria, and allowed channels.
The business or brand being promoted is the seller, not the target. Exclude the seller, its locations, franchises, close substitutes, and competitors unless the campaign explicitly identifies them as prospective customers.
Do not select a candidate merely because it resembles the promoted business. Each selection reason must explain why the candidate is a plausible buyer or client using the supplied goal and target criteria.
Select only candidates supplied in the prompt and copy their externalRef exactly.
A candidate is contactable when it has a phone number or a website that can support contact discovery.
Interpret geography semantically: city aliases, neighborhoods, and addresses may all describe the requested area.
Prefer strong category and geography matches. Do not fill the list with weak matches, lookalikes, or competitors when relevant prospective customers are unavailable.
Select up to requiredCount unique businesses. Return fewer selections, including none, when the supplied evidence does not support customer fit. Never invent candidates.
Give a concise reason for each selection. Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: LocationFinderDataSchema },
  },
});

/** Selects valid catalog candidates in the agent's ranked order. */
export async function selectReachableBusinesses(
  input: {
    readonly campaignGoal: string;
    readonly geography: string;
    readonly discoveryQuery: string;
    readonly targetCriteria: readonly string[];
    readonly channels: readonly string[];
    readonly requiredCount: number;
    readonly candidates: readonly {
      readonly externalRef: string;
      readonly name: string;
      readonly address: string;
      readonly locality: string;
      readonly categories: readonly string[];
      readonly websiteUrl: string | null;
      readonly phone: string | null;
    }[];
  },
  agent: StructuredAgent<LocationFinderData> = locationFinder,
) {
  const result = LocationFinderDataSchema.parse(
    (await agent.generate(JSON.stringify(input))).object,
  );
  const candidates = new Map(
    input.candidates.map((candidate) => [candidate.externalRef, candidate]),
  );
  return result.selections.map((selection) => {
    const candidate = candidates.get(selection.externalRef);
    if (candidate === undefined) {
      throw new Error(
        `Location Finder selected unavailable business ${selection.externalRef}.`,
      );
    }
    return { candidate, reason: selection.reason };
  });
}
