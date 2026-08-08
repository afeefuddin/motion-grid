import type { z } from "zod";
import type { CapabilityId } from "../contracts/capabilities";
import type {
  ChannelSchema,
  MotionIdSchema,
  TargetKindSchema,
} from "../contracts/enums";

export type MotionId = z.output<typeof MotionIdSchema>;
export type TargetKind = z.output<typeof TargetKindSchema>;
export type Channel = z.output<typeof ChannelSchema>;
export type ContactModel = "individual" | "none";
export type ConsentPolicy = "legitimate_interest" | "explicit_opt_in";
export type RubricSource =
  | "profile"
  | "website"
  | "reviews"
  | "segment"
  | "customer_data";

export interface RubricCriterion {
  readonly id: string;
  readonly description: string;
  readonly sources: readonly RubricSource[];
  readonly weight: number;
}

export interface MotionDefinition {
  readonly targetKind: TargetKind;
  readonly discovery: readonly CapabilityId[];
  readonly discoveryTrigger: string | null;
  readonly observation: readonly CapabilityId[];
  readonly rubric: readonly RubricCriterion[];
  readonly contactModel: ContactModel;
  readonly channels: readonly Channel[];
  readonly allocation: boolean;
  readonly terminalState: string;
  readonly consentPolicy: ConsentPolicy;
}

export function defineMotion<const Id extends MotionId>(
  id: Id,
  definition: MotionDefinition,
) {
  return { id, ...definition };
}

export function assessmentRubric(motion: MotionDefinition): string[] {
  return motion.rubric.map(
    (criterion) =>
      `${criterion.id} (weight ${criterion.weight}): ${criterion.description}`,
  );
}
