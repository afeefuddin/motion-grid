import type { z } from "zod";
import type {
  SegmentBuildInputSchema,
  SegmentBuildOutputSchema,
} from "../../contracts/capabilities";
import { deterministicNumber, unitCost, watchableDelay } from "./shared";

type Input = z.infer<typeof SegmentBuildInputSchema>;
type Output = z.infer<typeof SegmentBuildOutputSchema>;

function segmentRef(name: string, geography: string): string {
  return `sim:segment:${deterministicNumber(`${name}:${geography}`).toString(16)}`;
}

export const cohortSegmentSimAdapter = {
  adapterId: "cohort.segment",
  capability: "segment.build",
  unitCost: unitCost("request", 0),
  profile: {
    coverage: { geographies: ["Bengaluru"], categories: ["*"] },
    freshnessDays: 0,
    expectedConfidence: 0.85,
    rateLimitPerMinute: null,
    writesExternalState: false,
    productionPath: "First-party warehouse",
  },
  async execute(input: Input): Promise<Output> {
    await watchableDelay(input);
    const estimatedSize =
      18_000 +
      (deterministicNumber(JSON.stringify(input.criteria) + input.geography) %
        82_001);
    const payload = {
      description: input.description,
      estimatedSize,
      criteria: input.criteria,
    };
    return {
      target: {
        kind: "segment",
        externalRef: segmentRef(input.name, input.geography),
        name: input.name,
        payload,
      },
      payload,
      statistics: [
        {
          metric: "estimated_audience_size",
          value: estimatedSize,
          baseline: 120_000,
          method: "Seeded Bengaluru panel projection",
          window: "2026-Q2",
        },
        {
          metric: "weekly_category_intent_rate",
          value: 0.18 + (estimatedSize % 15) / 100,
          baseline: 0.14,
          method: "Synthetic stratified survey",
          window: "rolling 90 days",
        },
      ],
    };
  },
};
