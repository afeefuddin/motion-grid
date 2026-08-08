export type Currency = "USD" | "INR";

export interface Money<C extends Currency = Currency> {
  readonly amountMinor: number;
  readonly currency: C;
}

function validateAmount(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError(
      "Money must be a non-negative integer in minor units.",
    );
  }
}

export function usd(amountMinor: number): Money<"USD"> {
  validateAmount(amountMinor);
  return { amountMinor, currency: "USD" };
}

export function inr(amountMinor: number): Money<"INR"> {
  validateAmount(amountMinor);
  return { amountMinor, currency: "INR" };
}

export function addMoney<C extends Currency>(
  left: Money<C>,
  right: Money<NoInfer<C>>,
): Money<C> {
  if (left.currency !== right.currency) {
    throw new TypeError("Money in different currencies cannot be combined.");
  }
  validateAmount(left.amountMinor + right.amountMinor);
  return {
    amountMinor: left.amountMinor + right.amountMinor,
    currency: left.currency,
  };
}

export function subtractMoney<C extends Currency>(
  budget: Money<C>,
  spent: Money<NoInfer<C>>,
): Money<C> {
  if (budget.currency !== spent.currency) {
    throw new TypeError("Money in different currencies cannot be compared.");
  }
  return {
    amountMinor: Math.max(0, budget.amountMinor - spent.amountMinor),
    currency: budget.currency,
  };
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

export function formatInr(money: Money<"INR">): string {
  return inrFormatter.format(money.amountMinor / 100);
}
