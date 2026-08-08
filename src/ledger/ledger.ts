import type { z } from "zod";
import type { ToolCallEntry, ToolCallWriter } from "../capabilities/execute";
import type { CapabilityId, UnitCostSchema } from "../contracts/capabilities";
import { adapterCost } from "./cost";
import { inr, type Money, subtractMoney, usd } from "./money";

export interface DualCurrencyAmount {
  readonly operating: Money<"USD">;
  readonly commit: Money<"INR">;
}

export interface CostedPlan {
  readonly operating: readonly {
    readonly unitCost: z.output<typeof UnitCostSchema>;
    readonly units: number;
  }[];
  readonly commit: readonly Money<"INR">[];
}

export function estimate(plan: CostedPlan): DualCurrencyAmount {
  return {
    operating: usd(
      plan.operating.reduce(
        (total, item) =>
          total + adapterCost(item.unitCost, item.units).money.amountMinor,
        0,
      ),
    ),
    commit: inr(
      plan.commit.reduce((total, item) => total + item.amountMinor, 0),
    ),
  };
}

export interface CampaignBudgetState {
  readonly operatingBudgetCents: number;
  readonly operatingSpentCents: number;
  readonly commitBudgetCents: number;
  readonly commitSpentCents: number;
}

export function remaining(campaign: CampaignBudgetState): DualCurrencyAmount {
  return {
    operating: subtractMoney(
      usd(campaign.operatingBudgetCents),
      usd(campaign.operatingSpentCents),
    ),
    commit: subtractMoney(
      inr(campaign.commitBudgetCents),
      inr(campaign.commitSpentCents),
    ),
  };
}

/** In-memory running ledger suitable for workflows and straightforward repository adapters. */
export class CostLedger implements ToolCallWriter {
  #actualOperatingCents = 0;
  #projectedOperatingCents = 0;
  #commitPaise = 0;

  async record<C extends CapabilityId>(entry: ToolCallEntry<C>): Promise<void> {
    if (entry.projected) {
      this.#projectedOperatingCents += entry.operatingCostCents;
    } else {
      this.#actualOperatingCents += entry.operatingCostCents;
    }
  }

  recordCommit(amount: Money<"INR">): void {
    this.#commitPaise += amount.amountMinor;
  }

  spent(): DualCurrencyAmount {
    return {
      operating: usd(this.#actualOperatingCents),
      commit: inr(this.#commitPaise),
    };
  }

  projectedOperating(): Money<"USD"> {
    return usd(this.#projectedOperatingCents);
  }
}
