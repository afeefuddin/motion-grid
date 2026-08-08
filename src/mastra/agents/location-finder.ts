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
    "Chooses relevant and contactable local businesses from an available market catalog.",
  model: midAgentModel,
  instructions: `Choose local businesses that the campaign can realistically contact.
Use the campaign category, geography, target criteria, and allowed channels.
Select only candidates supplied in the prompt and copy their externalRef exactly.
A candidate is contactable when it has a phone number or a website that can support contact discovery.
Interpret geography semantically: city aliases, neighborhoods, and addresses may all describe the requested area.
Prefer strong category and geography matches, but use the closest available matches when exact matches do not exist.
Always select exactly requiredCount unique businesses. Never return fewer selections and never invent candidates.
Give a concise reason for each selection. Return only the structured result.`,
  defaultOptions: {
    maxSteps: 1,
    structuredOutput: { schema: LocationFinderDataSchema },
  },
});

/** Selects valid catalog candidates in the agent's ranked order. */
export async function selectReachableBusinesses(
  input: {
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
