import type { CapabilityId } from "../contracts/capabilities";
import { adapterCost, capabilityUnits } from "../ledger/cost";
import type { Adapter } from "./adapter";
import type { AdapterBinding } from "./binding";
import type {
  CapabilityDefinition,
  CapabilityInput,
  CapabilityOutput,
} from "./registry";

export interface ToolCallContext {
  readonly campaignId: string;
  readonly runId: string;
  readonly targetId: string | null;
}

export interface ToolCallEntry<C extends CapabilityId = CapabilityId> {
  readonly campaignId: string;
  readonly runId: string;
  readonly targetId: string | null;
  readonly capabilityId: C;
  readonly adapterId: string;
  readonly input: CapabilityInput<C>;
  readonly output: CapabilityOutput<C>;
  readonly operatingCostCents: number;
  readonly projected: boolean;
  readonly durationMs: number;
}

export interface ToolCallWriter {
  record<C extends CapabilityId>(entry: ToolCallEntry<C>): Promise<void>;
}

/**
 * The sole capability execution funnel. It validates both boundaries and records the
 * call before returning output, so callers cannot receive an unledgered result.
 */
export async function executeCapability<C extends CapabilityId>(options: {
  readonly context: ToolCallContext;
  readonly capability: CapabilityDefinition<C>;
  readonly binding: AdapterBinding<C>;
  readonly adapter: Adapter<C>;
  readonly input: CapabilityInput<C>;
  readonly ledger: ToolCallWriter;
  readonly now?: () => number;
}): Promise<CapabilityOutput<C>> {
  if (
    options.adapter.id !== options.binding.adapterId ||
    options.adapter.mode !== options.binding.mode ||
    !options.adapter.provides.includes(options.binding.capabilityId)
  ) {
    throw new Error(
      "The adapter does not match the persisted capability binding.",
    );
  }

  if (options.capability.id !== options.binding.capabilityId) {
    throw new Error(
      "The capability definition does not match the persisted binding.",
    );
  }
  const input = options.capability.input.parse(options.input);
  const now = options.now ?? Date.now;
  const startedAt = now();
  const output = options.capability.output.parse(
    await options.adapter.execute(options.binding.capabilityId, input),
  );
  const durationMs = Math.max(0, now() - startedAt);
  const cost = adapterCost(
    options.adapter.unitCost,
    capabilityUnits(options.binding.capabilityId, output),
  );

  await options.ledger.record({
    ...options.context,
    capabilityId: options.binding.capabilityId,
    adapterId: options.adapter.id,
    input,
    output,
    operatingCostCents: cost.money.amountMinor,
    projected: cost.projected,
    durationMs,
  });
  return output;
}
