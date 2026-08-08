import type { z } from "zod";
import {
  type CapabilityId,
  capabilityContracts,
} from "../contracts/capabilities";

export type CapabilityInput<C extends CapabilityId> = z.output<
  (typeof capabilityContracts)[C]["input"]
>;

export type CapabilityOutput<C extends CapabilityId> = z.output<
  (typeof capabilityContracts)[C]["output"]
>;

export type CapabilityUnitCost<C extends CapabilityId> = z.output<
  (typeof capabilityContracts)[C]["unitCost"]
>;

export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export interface CapabilityDefinition<C extends CapabilityId> {
  readonly id: C;
  readonly input: RuntimeSchema<CapabilityInput<C>>;
  readonly output: RuntimeSchema<CapabilityOutput<C>>;
  readonly unitCost: RuntimeSchema<CapabilityUnitCost<C>>;
}

/**
 * Defines a capability from the frozen contract schemas.
 *
 * The schemas are deliberately supplied by the caller so a definition is easy to
 * inspect, while the generic contract prevents a capability from borrowing another
 * capability's input or output shape.
 */
export function defineCapability<C extends CapabilityId>(
  id: C,
  contract: (typeof capabilityContracts)[C],
) {
  return { id, ...contract };
}

export const capabilityRegistry = {
  "geo.query": defineCapability("geo.query", capabilityContracts["geo.query"]),
  "db.query": defineCapability("db.query", capabilityContracts["db.query"]),
  "web.fetch": defineCapability("web.fetch", capabilityContracts["web.fetch"]),
  "reviews.fetch": defineCapability(
    "reviews.fetch",
    capabilityContracts["reviews.fetch"],
  ),
  "people.find": defineCapability(
    "people.find",
    capabilityContracts["people.find"],
  ),
  "segment.build": defineCapability(
    "segment.build",
    capabilityContracts["segment.build"],
  ),
  "message.send": defineCapability(
    "message.send",
    capabilityContracts["message.send"],
  ),
  "ads.plan": defineCapability("ads.plan", capabilityContracts["ads.plan"]),
};

export function getCapability<C extends CapabilityId>(
  id: C,
): (typeof capabilityRegistry)[C] {
  return capabilityRegistry[id];
}
