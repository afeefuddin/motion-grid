import type { z } from "zod";
import type { CapabilityId } from "../contracts/capabilities";
import type { AdapterModeSchema } from "../contracts/enums";
import type {
  CapabilityInput,
  CapabilityOutput,
  CapabilityUnitCost,
} from "./registry";

export type AdapterMode = z.output<typeof AdapterModeSchema>;

/** Adapter contract implemented by simulation, live, and planning providers. */
export interface Adapter<C extends CapabilityId = CapabilityId> {
  readonly id: string;
  readonly provides: readonly C[];
  readonly mode: AdapterMode;
  readonly unitCost: CapabilityUnitCost<C>;
  execute(
    capabilityId: C,
    input: CapabilityInput<C>,
  ): Promise<CapabilityOutput<C>>;
}
