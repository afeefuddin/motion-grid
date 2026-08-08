# C2 · Contract Amendment — the one unfreeze

**Wave 1.5 · ~1.5h · BLOCKING for T5, T6, T9 · single owner · runs parallel with T4 and C1**

Contracts were frozen after T0, and that discipline is why three waves landed with zero casts.
This task is the **one deliberate, owned unfreeze**, needed because the demo's centre of
gravity moved to orchestration and the current contracts cannot express a decision — only its
outcome.

Nothing here changes existing field semantics. Every change is **additive**, except two
acknowledged bug fixes called out below. After this task, contracts are frozen again.

## Owned paths (exclusive write)

```
src/contracts/**
src/db/schema.ts + one migration        (you are the migration owner for this change only)
src/capabilities/adapter.ts             (adding metadata to the Adapter interface)
src/ledger/cost.ts                      (one unit-billing fix)
src/policy/types.ts + src/policy/evaluate.ts   (one structured-warning fix)
```

## Read-only

Everything else.

## Coordination — read this before you touch anything

- **T4 is in flight and owns `src/mastra/agents/**`, `src/mastra/tools/**`, `src/motions/**`.**
  Do not edit those paths, and do not change any field T4's planner agent already emits.
  Everything you add to `PlanDataSchema` and `MotionPlanSchema` is **optional or defaulted**,
  so T4's existing output stays valid. T5 populates the new fields.
- Every adapter in `src/adapters/sim/**` (T2, complete) must gain the new metadata. That is a
  mechanical addition to six files. It is the one exception to *read-only*, and it is yours.
  Do not change any adapter's `execute` behaviour.
- Announce completion loudly. T5 and T6 cannot start their real work without this.

---

## Why these changes

The orchestrator is now the product. On stage, three decisions must be visible and defensible:
which motions run, which capabilities each needs, and **which provider serves each capability
and why that one won**. Today `MotionPlanSchema` carries `capabilities: CapabilityId[]` — a
list of what was chosen, with no record of what was considered or rejected.

The design principle for the whole feature:

> **The model decides what matters. Deterministic code decides who wins, and shows its work.**

An LLM picking a vendor is unauditable and irreproducible. A deterministic scorer over declared
adapter metadata, weighted by priorities the model derived from the objective, is both — and it
is a genuinely better answer, not a compromise. The contracts below encode that split.

---

## 1. Adapter capability profile

`Adapter` (`src/capabilities/adapter.ts`) currently declares `id`, `provides`, `mode`,
`unitCost`, `execute`. Ranking needs declared, comparable metadata. Add a required `profile`:

| Field | Type | Meaning |
|---|---|---|
| `coverage` | `{ geographies: string[]; categories: string[] }` | `["*"]` means unrestricted |
| `freshnessDays` | `number` | age of the data this adapter returns; `0` for live fetch |
| `expectedConfidence` | `number` 0–1 | declared, not measured |
| `rateLimitPerMinute` | `number \| null` | `null` for unlimited |
| `writesExternalState` | `boolean` | true for `message.send` |
| `productionPath` | `string` | e.g. `"Outscraper, Google Places"` — this is the go-to-prod line, rendered in the UI |

`costPerUnit` is **not** a new field — it is already `unitCost.operatingCents`. Do not
duplicate it.

This is the *capability registry records* list from `docs/PRODUCT.md` finally implemented.

## 2. `generated` adapter mode

`adapterModes` is `sim | live | plan`. Add `generated` for T8's runtime market synthesiser.

The whole point of the demo's adapter-swap beat is showing **three adapters behind one
contract** with different profiles — `sim` (free, instant, fixed world), `generated` (small
cost, any geography), `live` (real cost, real data). Ranking makes that difference legible.

Check whether adapter mode is persisted anywhere in `src/db/schema.ts`; if it is, this needs a
migration.

## 3. Ranked binding

New in `contracts/steps.ts`, and the centrepiece of this task:

```
RankingWeightsSchema      cost · freshness · confidence · coverage — each 0–1, must sum to 1
AdapterCandidateSchema    adapterId, mode, dimensionScores (one per weight), totalScore,
                          eligible: boolean, reason: string
RankedBindingSchema       capabilityId, weights, weightsRationale: string,
                          candidates: AdapterCandidate[]  (all of them, ranked, losers included),
                          chosen: { adapterId, mode }
```

`candidates` holds **every** adapter considered, ranked, with each one's score and the reason
it won or lost. That array is what the plan screen renders. A ranking that only records the
winner is not an auditable decision.

`weights` come from the model; `dimensionScores` and `totalScore` come from deterministic code
in T5. `weightsRationale` is the model's one-sentence explanation, quoted verbatim in the UI.

## 4. Plan schema additions — all optional

```
MotionPlanSchema
  + bindings:  RankedBindingSchema[]                              default []
  + declined:  { capabilityId, reason }[]                         default []

PlanDataSchema
  + declinedMotions: { motionId, reason }[]                       default []
  + replanOf:        { planId, trigger, reason } | null           default null
```

`declinedMotions` is a demo beat, not bookkeeping: `consumer.ads` being visibly **declined**
with *"no first-party customer data source is connected"* is a stronger argument for a
reasoning orchestrator than a fourth branch quietly executing.

`replanOf` supports T5's re-plan path — when a binding fails to resolve or a policy denies
mid-run, the orchestrator re-ranks and produces a new plan that points at the one it replaced.
`runKinds` already has `replan`; nothing new needed there.

## 5. Structured budget warning — bug fix

`operatingBudgetCap` (`src/policy/evaluate.ts:23`) signals the 80% threshold by returning
`allow` with the warning **embedded in the reason prose**. The UI would have to pattern-match
English to render a budget banner.

Add an optional structured field to `PolicyDecision`:

```
warning?: { kind: "budget_threshold"; utilizationBasisPoints: number }
```

Keep the reason string exactly as it is — the existing policy tests assert on it and must
still pass unchanged. This is purely additive.

## 6. `ads.plan` unit billing — bug fix

`capabilityUnits` (`src/ledger/cost.ts:47`) bills `ads.plan` per **estimated impression**.
`adapterCost` computes `ceil(operatingCents × units)`, so a 500,000-impression estimate at any
nonzero rate produces an absurd operating cost — and impressions are a *commit*-side quantity
being billed against the *operating* budget, which is precisely the conflation the dual-budget
design exists to prevent.

Bill it as **one request**. Update the unit-cost schema for `ads.plan` from `impression` to
`request` to match.

## 7. SSE event union

`contracts/api.ts` needs events for the decisions above, so the plan screen can stream them:

```
motion_selected · motion_declined · capability_ranked · binding_chosen
policy_warning  · replan_started
```

Follow the existing union's naming and shape exactly. T9 renders these; T7 emits them.

## 8. Documentation-only corrections

Neither is a code change — fix the prose so the next agent isn't misled:

`docs/PLAN.md` and T7 have already been corrected for the `message.send:whatsapp` /
`message.send:email` error — there is **one** `message.send` capability with a `channel` field.
Check `contracts/enums.ts` rather than any older prose, and correct anything you find that still
disagrees.

---

## The seven engineering rules

Unchanged, and rule 1 is the reason this task is centralised in one owner rather than done
opportunistically by three.

## Done when

- [ ] Every addition is optional or defaulted; **T4's current planner output still parses**
- [ ] All six sim adapters declare a `profile`; none has changed `execute` behaviour
- [ ] Existing policy tests pass **unchanged** — the reason strings are untouched
- [ ] `ads.plan` bills one request; a 500k-impression estimate no longer moves the operating ledger
- [ ] Migration generated and applied if adapter mode is persisted
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm check` green across the repo
- [ ] `grep -rn " as \| any" src/contracts src/capabilities src/policy src/ledger` returns nothing
- [ ] **Announced to T5, T6, T9 owners** — they are blocked until this lands
- [ ] Handoff note written

---

## Handoff note

_(fill in — the exact new schema names T5 and T9 import, and anything you found in the
contracts that is wrong but you deliberately did not change.)_
