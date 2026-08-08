# T3 · Capability Registry, Policy Engine, Cost Ledger

**Wave 1 · parallel with T1, T2, T4, T5 · ~4h · depends on T0**

Three pieces of pure logic that everything else routes through. Almost no I/O — this is the
most testable task in the build, and it should be near-100% covered.

## Owned paths (exclusive write)

```
src/capabilities/**
src/policy/**
src/ledger/**
```

## Read-only

`src/contracts/**` — **frozen**. Escalate rather than edit.

## Forbidden

`src/adapters/**` (T2/T7), `src/mastra/**` (T4/T6), `src/db/repositories/**` (T1), `app/`.

You define the **adapter interface**; T2 and T7 implement against it. Coordinate through the
contract, not by editing their files.

## Deliverables

### 1. `src/capabilities/**` — registry + binding

- `registry.ts` — `defineCapability(id, { input, output, unitCost })`, backed by the schemas
  in `contracts/capabilities.ts`.
- `adapter.ts` — the `Adapter` interface: `{ id, provides: CapabilityId[], mode: 'sim' |
  'live' | 'plan', unitCost, execute }`.
- `binding.ts` — resolve `capability → adapter` given a mode preference. Deterministic:
  a plan records exactly which adapter was bound, and a run must use that one.
- **Every capability call goes through one funnel** that writes a `tool_call` ledger row.
  Nothing bypasses it.

### 2. `src/policy/**` — deterministic gate

Evaluated before **every** external side effect. Returns
`{ decision: 'allow' | 'deny' | 'require_approval', reason: string }`. The reason string is
rendered in the UI, so write it for a human.

| Policy | Rule |
|---|---|
| `operating_budget_cap` | warn at 80%, **hard-pause at 100%** |
| `external_spend_commit` | `max_per_deal`, `max_total`, `requires_role` — creator fees + ad spend |
| `require_approval(send)` | every outbound message |
| `require_approval(roster)` | creator allocation |
| `consent_policy` | per-motion: `legitimate_interest` vs `explicit_opt_in` |
| `suppression_check` | campaign + workspace scope |
| `rate_limit` | per channel, per run |

**This is where the product's credibility lives.** Qualification is a model call; policy,
budget, suppression and consent are pure code. When someone asks what stops the agent
emailing an opted-out contact, the answer must be "a deterministic check, not a prompt."

### 3. `src/ledger/**` — dual-currency cost

**Two budgets, never summed — and they are in different currencies:**

| Budget | What | Currency | Magnitude |
|---|---|---|---|
| `operating` | inference, data, delivery | **USD** (vendor-billed) | cents to a few dollars |
| `commit` | creator fees, ad spend | **INR** (we're paying Indian creators) | ₹thousands to ₹lakhs |

Store every amount as `{ amountMinor: number, currency: 'USD' | 'INR' }` — integer minor
units, never a float. The two-currency split you already have makes this free: they were
never summable, and now they're not even the same unit. **Do not build FX conversion** —
display each natively. A function returning a single merged total is a bug.

Provide:

- token usage → USD per model
- adapter unit cost → USD (shadow costs from T2 are *projected* and must be flagged so the UI
  never shows projected spend as real)
- `estimate(plan)` → `{ operating: Money, commit: Money }` before execution
- `record(toolCall)` → running spend
- `remaining(campaign)` → `{ operating: Money, commit: Money }`
- an INR formatter using **Indian digit grouping** (₹1,50,000, not ₹150,000) —
  `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`

## Tests — this task is expected to be heavily tested

- Policy decision table exercised exhaustively: every policy × allow/deny/approval path.
- Budget cap at 79%, 80%, 99%, 100%, 101%.
- `external_spend_commit` rejecting a creator whose rate exceeds `max_per_deal`, **with the
  reason string asserted** — T8 surfaces it in the roster UI.
- Ledger arithmetic in both currencies, including that they never merge.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. Parse at the edge, trust inside.
3. **Zero `as`. Zero `any`.**
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **None apply here — this task has no try/catch.**
5. **Errors are values** — policy returns a decision object, it never throws. A denied action
   is a normal outcome, not an exception.
6. No defensive optional chaining.
7. Adapters are pure w.r.t. their contract.

## Done when

- [ ] Registry resolves every capability to a bound adapter
- [ ] Every capability call writes a `tool_call` row — no bypass path exists
- [ ] Policy decision table fully covered by tests
- [ ] Ledger tested in both currencies; no function returns a summed total
- [ ] `grep -rn " as \| any" src/capabilities src/policy src/ledger` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially the adapter interface shape, so T7 implements against the same thing
T2 did)_
