# T5 · Orchestrator — Selection, Ranking, Re-plan

**Wave 2 · parallel with T6, T7, T8 · ~4h · depends on T3, T4, C2**

> This slot previously held "UI against mocks." That task is cut — the mock layer and its
> rewire were two passes at one screen set, and T9 now builds the UI once. **The orchestrator
> is the product**, so it gets the slot.

You own the decision layer. Everything else in this repo executes a decision; this task makes
one, records why, and can make it again differently when the harness refuses.

## Owned paths (exclusive write)

```
src/orchestrator/**
```

## Read-only

`src/contracts/**` (frozen again after C2) · `src/capabilities/**`, `src/policy/**`,
`src/ledger/**` (T3) · `src/motions/**`, `src/mastra/agents|tools/**` (T4) ·
`src/adapters/**` (T2, T8) · `src/db/repositories/**` (T1)

**Read C2's handoff note first.** It names the exact schemas you populate.

## Forbidden

`src/contracts/**`, `src/mastra/workflows/**` (T6 composes your functions into steps),
`apps/web/**`, everything else.

---

## The idea in one line

**The model decides what matters. Deterministic code decides who wins, and shows its work.**

A model that picks a vendor is unauditable, irreproducible, and impossible to defend when a
judge asks *"why that one?"* A deterministic scorer over declared adapter metadata — weighted
by priorities the model derived from the objective — answers that question with a number and a
sentence. Build it that way and the honest answer on stage is the impressive one.

---

## Deliverable 1 · Motion selection

Input: the compiled `CampaignSpec`. Output: `PlanData` with `motions[]` **and**
`declinedMotions[]`.

Five motions are registered by T4. For each, the orchestrator decides run or decline, with a
reason, against declared motion requirements and connected data sources.

**`consumer.ads` must be declined, not executed.** Its reason — *"no first-party customer data
source is connected; segment.build has no warehouse to build from"* — is demo beat 2 and it is
worth more than a fourth branch quietly producing an estimate. `business.online` and
`consumer.email` decline the same way. `business.local` and `creator` run.

An orchestrator that visibly refuses work it cannot justify is the single most credible thing
on stage. Do not soften a decline into a warning.

## Deliverable 2 · Capability selection

Per selected motion: which capabilities are required, which are available-but-skipped, each with
a reason. Skipped ones go in `MotionPlan.declined`.

The motion declaration (T4) states the capability set; the orchestrator may narrow it from the
objective. *"The objective asks for booking-flow gaps, so `reviews.fetch` and `web.fetch` are
both required; `people.find` is deferred until a target scores fit"* is a real narrowing and it
saves real operating spend — surface that saving.

## Deliverable 3 · Adapter ranking — the centrepiece

For every selected capability, produce a `RankedBinding`.

**Step A — the model sets weights.** One agent call over the `CampaignSpec` returns
`RankingWeights` (`cost`, `freshness`, `confidence`, `coverage`, summing to 1) plus a
one-sentence `weightsRationale`. A tight budget weights cost; *"businesses that opened
recently"* weights freshness; a named locality weights coverage. Validate the sum; reject and
retry rather than normalising silently — a model that can't produce four numbers summing to 1
should not be trusted with the campaign.

**Step B — deterministic scoring.** For each adapter that `provides` the capability, score each
dimension 0–1 from its `profile` (C2) and `unitCost`:

- `cost` — cheapest candidate scores 1, others scale down against it
- `freshness` — from `profile.freshnessDays`, lower is better
- `confidence` — `profile.expectedConfidence` directly
- `coverage` — does `profile.coverage` contain the spec's geography and categories, or `"*"`

`totalScore` is the weighted sum. Ineligible candidates (no coverage, rate limit below required
throughput) score but are marked `eligible: false` **and stay in the array** with their reason.
Highest eligible score wins; ties break by `adapterId` so a re-run is identical.

**Step C — bind.** Call T3's `bindCapability` with the ranked winner and persist the full
`RankedBinding` — every candidate, every score, every reason — into the plan.

That persisted array is what the plan screen renders as a ranked table. When `geo.query` shows
`sim/market` beating `generated/market` beating `outscraper` with scores and reasons, the
"swapping the adapter is one line" claim stops being a slide and becomes a thing the audience
watched happen.

**Pure function.** Scoring takes adapter profiles and weights, returns candidates. No
database, no I/O, no clock. It must be unit-testable in isolation, and it must be — this is the
one algorithm a judge might actually ask you to explain.

## Deliverable 4 · Re-plan on refusal

The strongest orchestration beat available, and it costs about an hour.

When the harness refuses mid-run — `resolveBinding` fails because a bound adapter is gone, or
`evaluatePolicies` returns `deny` on operating budget — the orchestrator does not abort. It
re-ranks with the refusal as a new constraint, emits `replan_started`, and produces a new plan
whose `replanOf` points at the one it replaced.

Concretely, for the demo: **drop the operating budget mid-run.** The budget policy denies, the
orchestrator re-ranks with `cost` weighted far higher, rebinds `geo.query` from a paid adapter
to the sim adapter, and the run continues. The audience sees a system that was told *no* and
reasoned its way to a different plan rather than throwing.

This is P1. If time runs out, cut Deliverable 2's narrowing before you cut this.

## Deliverable 5 · Target ranking is already there — make it legible

Do not build a second ranker. `assessStep` (T6) scores targets and T8's allocation ranks
creators by fit-per-rupee. Your job is only to ensure the plan declares the **rubric and the
ordering** those steps use, so the grid can sort by score and the evidence drawer can say what
the score was measured against. Rank order visible, rejected rows visible with reasons.

---

## What you must not do

- **Do not let the model choose an adapter directly.** It sets weights; code ranks. If you find
  yourself putting adapter IDs in a prompt, the design has inverted.
- **Do not drop losing candidates.** A ranking with one row is a decision with no evidence.
- **Do not normalise malformed weights silently.** Reject and retry.
- **Do not re-plan in a loop.** Cap it — two re-plans per run, then fail with a stated reason.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`, as amended by C2 and frozen again.
2. Parse at the edge — the weights agent's structured output is a parse boundary.
3. **Zero `as`. Zero `any`.**
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **None are in this task.**
5. Errors are values — `{ ok: true, data } | { ok: false, reason }`.
6. No defensive optional chaining.
7. The scorer is pure. Same profiles, same weights → same ranking, byte for byte.

## Done when

- [ ] `consumer.ads`, `business.online`, `consumer.email` are declined with reasons in `declinedMotions`
- [ ] Every selected capability has a `RankedBinding` containing **all** candidates with scores
- [ ] Weights come from the model with a rationale; scores come from code; the split is provable
      by a test that ranks with fixed weights and no model call
- [ ] Malformed weights are rejected, not normalised
- [ ] Ranking is deterministic — same spec twice, identical candidate order and identical scores
- [ ] Budget denial mid-run triggers a re-plan that rebinds to a cheaper adapter and continues
- [ ] Re-plan is capped and fails with a stated reason at the cap
- [ ] Scorer unit-tested as a pure function with zero database and zero model calls
- [ ] `grep -rn " as \| any" src/orchestrator` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially: the exact function T6 calls to plan, the function it calls to re-plan,
and which adapter wins each capability in the demo campaign so T10 can script around it.)_
