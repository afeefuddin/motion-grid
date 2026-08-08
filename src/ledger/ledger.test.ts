import assert from "node:assert/strict";
import test from "node:test";
import { adapterCost, tokenUsageToUsd } from "./cost";
import { CostLedger, estimate, remaining } from "./ledger";
import { addMoney, formatInr, inr, usd } from "./money";

test("money arithmetic retains its native currency", () => {
  assert.deepEqual(addMoney(usd(125), usd(75)), {
    amountMinor: 200,
    currency: "USD",
  });
  assert.deepEqual(addMoney(inr(10_000), inr(5_000)), {
    amountMinor: 15_000,
    currency: "INR",
  });
});

test("estimate and remaining return two currencies without a merged total", () => {
  assert.deepEqual(
    estimate({
      operating: [
        {
          unitCost: {
            unit: "record",
            operatingCents: 0.3,
            commitCents: 0,
            projected: true,
          },
          units: 10,
        },
      ],
      commit: [inr(150_000_00), inr(25_000_00)],
    }),
    {
      operating: { amountMinor: 3, currency: "USD" },
      commit: { amountMinor: 17_500_000, currency: "INR" },
    },
  );
  assert.deepEqual(
    remaining({
      operatingBudgetCents: 1_000,
      operatingSpentCents: 275,
      commitBudgetCents: 20_000_000,
      commitSpentCents: 2_500_000,
    }),
    {
      operating: { amountMinor: 725, currency: "USD" },
      commit: { amountMinor: 17_500_000, currency: "INR" },
    },
  );
});

test("projected adapter costs stay separate from actual spend", async () => {
  const ledger = new CostLedger();
  await ledger.record({
    campaignId: "campaign-1",
    runId: "run-1",
    targetId: null,
    capabilityId: "geo.query",
    adapterId: "market.geo",
    input: {
      query: "salon",
      latitude: 12,
      longitude: 77,
      radiusKm: 5,
      limit: 1,
    },
    output: { targets: [] },
    operatingCostCents: 4,
    projected: true,
    durationMs: 10,
  });
  assert.equal(ledger.spent().operating.amountMinor, 0);
  assert.equal(ledger.projectedOperating().amountMinor, 4);
});

test("token and adapter pricing round up to integer USD cents", () => {
  assert.deepEqual(
    adapterCost(
      { unit: "record", operatingCents: 0.3, commitCents: 0, projected: true },
      1,
    ),
    { money: { amountMinor: 1, currency: "USD" }, projected: true },
  );
  assert.deepEqual(
    tokenUsageToUsd({
      model: "anthropic/claude-sonnet-4-6",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    }),
    { amountMinor: 1_800, currency: "USD" },
  );
});

test("INR formatter uses Indian digit grouping", () => {
  assert.match(formatInr(inr(150_000_00)), /1,50,000/);
});
