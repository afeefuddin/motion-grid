import type { z } from "zod";
import type { CapabilityId } from "../contracts/capabilities";
import type { AdapterModeSchema } from "../contracts/enums";
import type {
  CapabilityInput,
  CapabilityOutput,
  CapabilityUnitCost,
} from "./registry";

export type AdapterMode = z.output<typeof AdapterModeSchema>;

/** Comparable metadata used to rank adapters for an objective. */
export interface AdapterProfile {
  readonly coverage: {
    readonly geographies: readonly string[];
    readonly categories: readonly string[];
  };
  readonly freshnessDays: number;
  readonly expectedConfidence: number;
  readonly rateLimitPerMinute: number | null;
  readonly writesExternalState: boolean;
  readonly productionPath: string;
}

/** Adapter contract implemented by simulation, generated, live, and planning providers. */
export interface Adapter<C extends CapabilityId = CapabilityId> {
  readonly id: string;
  readonly provides: readonly C[];
  readonly mode: AdapterMode;
  readonly unitCost: CapabilityUnitCost<C>;
  readonly profile: AdapterProfile;
  execute(
    capabilityId: C,
    input: CapabilityInput<C>,
  ): Promise<CapabilityOutput<C>>;
}
