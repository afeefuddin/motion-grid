import type { z } from "zod";
import type { CapabilityOutput } from "../capabilities/registry";
import {
  type CapabilityId,
  capabilityContracts,
  type UnitCostSchema,
} from "../contracts/capabilities";
import { type Money, usd } from "./money";

export interface PricedOperatingCost {
  readonly money: Money<"USD">;
  readonly projected: boolean;
}

export function adapterCost(
  unitCost: z.output<typeof UnitCostSchema>,
  units: number,
): PricedOperatingCost {
  if (!Number.isSafeInteger(units) || units < 0) {
    throw new RangeError("Adapter units must be a non-negative integer.");
  }
  return {
    money: usd(Math.ceil(unitCost.operatingCents * units)),
    projected: unitCost.projected,
  };
}

export function capabilityUnits<C extends CapabilityId>(
  capabilityId: C,
  output: CapabilityOutput<C>,
): number {
  switch (capabilityId) {
    case "geo.query":
      return capabilityContracts["geo.query"].output.parse(output).targets
        .length;
    case "db.query":
      return capabilityContracts["db.query"].output.parse(output).targets
        .length;
    case "reviews.fetch":
      return capabilityContracts["reviews.fetch"].output.parse(output).reviews
        .length;
    case "people.find":
      return capabilityContracts["people.find"].output.parse(output).people
        .length;
    case "message.send":
      return 1;
    case "ads.plan":
      return capabilityContracts["ads.plan"].output.parse(output)
        .estimatedImpressions;
    case "web.fetch":
    case "segment.build":
      return 1;
  }
}

export interface TokenUsage {
  readonly model: ModelId;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type ModelId = keyof typeof modelUsdPerMillionTokens;

export const modelUsdPerMillionTokens = {
  "anthropic/claude-opus-4-7": { input: 5, output: 25 },
  "anthropic/claude-sonnet-4-6": { input: 3, output: 15 },
} satisfies Record<string, { readonly input: number; readonly output: number }>;

export function tokenUsageToUsd(usage: TokenUsage): Money<"USD"> {
  if (
    !Number.isSafeInteger(usage.inputTokens) ||
    usage.inputTokens < 0 ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.outputTokens < 0
  ) {
    throw new RangeError("Token counts must be non-negative integers.");
  }
  const price = modelUsdPerMillionTokens[usage.model];
  const cents =
    ((usage.inputTokens * price.input + usage.outputTokens * price.output) *
      100) /
    1_000_000;
  return usd(Math.ceil(cents));
}
