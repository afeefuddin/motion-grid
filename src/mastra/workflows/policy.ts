import type { z } from "zod";
import type { PlanDataSchema } from "../../contracts/steps";
import { evaluatePolicies } from "../../policy/evaluate";
import type { ReplanController } from "./replan";

type PlanData = z.output<typeof PlanDataSchema>;

/** Evaluates the operating cap and converts its denial into a bounded re-plan. */
export async function evaluateOperatingBudget(options: {
  readonly plan: PlanData;
  readonly budgetCents: number;
  readonly spentCents: number;
  readonly proposedCents: number;
  readonly replans: ReplanController;
}): Promise<
  | {
      readonly ok: true;
      readonly plan: PlanData;
      readonly warning: string | null;
    }
  | { readonly ok: false; readonly reason: string }
> {
  const decision = evaluatePolicies([
    {
      kind: "operating_budget_cap",
      budgetCents: options.budgetCents,
      spentCents: options.spentCents,
      proposedCents: options.proposedCents,
    },
  ]);
  if (decision.decision !== "deny") {
    return {
      ok: true,
      plan: options.plan,
      warning: decision.warning === undefined ? null : decision.reason,
    };
  }

  const replanned = await options.replans.request(
    options.plan,
    "operating_budget_cap",
    decision.reason,
  );
  if (!replanned.ok) {
    return replanned;
  }
  return { ok: true, plan: replanned.plan, warning: null };
}
