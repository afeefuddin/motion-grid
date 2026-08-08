import type { CapabilityId } from "../contracts/capabilities";
import type { Adapter, AdapterMode } from "./adapter";

export interface AdapterBinding<C extends CapabilityId = CapabilityId> {
  readonly capabilityId: C;
  readonly adapterId: string;
  readonly mode: AdapterMode;
}

export type BindingResult<C extends CapabilityId> =
  | {
      readonly ok: true;
      readonly binding: AdapterBinding<C>;
      readonly adapter: Adapter<C>;
    }
  | { readonly ok: false; readonly reason: string };

/** Resolves once during planning; persist the returned binding in the plan. */
export function bindCapability<C extends CapabilityId>(
  capabilityId: C,
  adapters: readonly Adapter<C>[],
  modePreference: readonly AdapterMode[],
): BindingResult<C> {
  for (const mode of modePreference) {
    const candidates = [...adapters]
      .filter(
        (adapter) =>
          adapter.mode === mode && adapter.provides.includes(capabilityId),
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    const adapter = candidates[0];
    if (adapter !== undefined) {
      return {
        ok: true,
        adapter,
        binding: { capabilityId, adapterId: adapter.id, mode: adapter.mode },
      };
    }
  }

  return {
    ok: false,
    reason: `No adapter provides ${capabilityId} in the requested modes: ${modePreference.join(", ")}.`,
  };
}

/** Resolves a persisted plan binding without silently substituting another adapter. */
export function resolveBinding<C extends CapabilityId>(
  binding: AdapterBinding<C>,
  adapters: readonly Adapter<C>[],
): BindingResult<C> {
  const adapter = adapters.find(
    (candidate) =>
      candidate.id === binding.adapterId &&
      candidate.mode === binding.mode &&
      candidate.provides.includes(binding.capabilityId),
  );
  if (adapter === undefined) {
    return {
      ok: false,
      reason: `Bound adapter ${binding.adapterId} is unavailable for ${binding.capabilityId}; the run was not rebound.`,
    };
  }
  return { ok: true, binding, adapter };
}
