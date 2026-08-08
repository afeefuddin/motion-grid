import type { z } from "zod";
import type {
  WebFetchInputSchema,
  WebFetchOutputSchema,
} from "../../contracts/capabilities";
import { simWorld } from "../../sim/world";
import { unitCost, watchableDelay } from "./shared";

type Input = z.infer<typeof WebFetchInputSchema>;
type Output = z.infer<typeof WebFetchOutputSchema>;

export const marketWebSimAdapter = {
  adapterId: "market.web",
  capability: "web.fetch",
  unitCost: unitCost("request", 0),
  profile: {
    coverage: { geographies: ["Bengaluru"], categories: ["*"] },
    freshnessDays: 0,
    expectedConfidence: 1,
    rateLimitPerMinute: null,
    writesExternalState: false,
    productionPath: "Firecrawl",
  },
  async execute(input: Input): Promise<Output> {
    await watchableDelay(input);
    const business = simWorld.businesses.find(
      (candidate) => candidate.id === input.externalRef,
    );
    return {
      sourceRef: `sim:web:${input.externalRef}`,
      url: input.url,
      contentType: "text/html; charset=utf-8",
      content: business === undefined ? "" : business.website.html,
      fetchedAt:
        business === undefined
          ? simWorld.generatedAt
          : business.website.capturedAt,
    };
  },
};
