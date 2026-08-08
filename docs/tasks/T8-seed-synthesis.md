# T8 · Seed, Generated Market, Edge Discovery, Creator Allocation

**Wave 2 · parallel with T5, T6, T7 · ~4h · depends on T1, T2, T3, C2**

Two deterministic algorithms, one new adapter, and the seed that makes the demo reproducible.
Only the new adapter calls a model — allocation and edge discovery are decisions we can compute
exactly, so we should.

**Changed since the first draft:** you now also own the `generated` market adapter, which is
what lets the demo accept an objective nobody rehearsed.

## Owned paths (exclusive write)

```
src/synthesis/**
src/adapters/generated/**
scripts/**
```

## Read-only

`src/contracts/**` (frozen again after C2) · `src/db/repositories/**` (T1) · `src/sim/**` (T2) ·
`src/policy|ledger/**` (T3) · `src/capabilities/**` (T3)

Read **T2's handoff note first** — it tells you which creators mention which businesses, and it
documents the fixture shape your generated adapter must match.

## Forbidden

`src/mastra/**`, `src/orchestrator/**`, `apps/web/**`, `src/adapters/sim/**`.

---

## 1. `scripts/seed.ts`

`pnpm seed` produces a demo-ready database:

- **Workspace** — the seller. We're a Bengaluru company selling booking/website software to
  local service businesses. Fill in ICP, proof points, and sender identities (WhatsApp number,
  from-email).
- **Demo campaign preset** so the objective box can be pre-filled on stage rather than typed
  from scratch if time is tight.
- Sim fixtures loaded into `target` rows.

Idempotent — running it twice must not duplicate anything.

## 2. Generated market adapter — `src/adapters/generated/**`

The committed fixture covers six Bengaluru localities and six categories. A judge who asks for
*"dental clinics in Pune"* currently gets nothing. This adapter fixes that without giving up
determinism.

**Contract:** it implements the same `geo.query`, `web.fetch`, `reviews.fetch` and
`people.find` contracts the sim adapters implement, with `mode: "generated"` (added in C2). It
is a sibling, not a replacement — T5's ranker chooses between them, and the sim adapter wins
on cost and latency whenever the fixture covers the request.

**Determinism is non-negotiable.** Cache by `(geography, category, limit, seed)`:

- Cache hit → return the cached world. No model call, no network.
- Cache miss → one model call synthesises the market, the result is validated against T2's
  `SimWorldSchema`, written to the cache, and returned.

Cache to disk under `src/adapters/generated/cache/`, committed. A rehearsed demo therefore
never calls a model at discovery time, and an off-script demo calls it exactly once. Run two of
the same objective is byte-identical to run one — the determinism check in T10 covers this
adapter too.

**Hard rule, inherited from T2: the generator emits artifacts, never signals.** It produces
business records, website HTML with defects genuinely present in the markup, and reviews in the
register Indian Google Maps reviews actually use. It must never emit a finding, a score, or a
qualification. Break this and the evidence pipeline is a puppet show — the whole verification
claim collapses.

Pre-warm the cache for two or three plausible off-script asks (a different city, a different
category) before the demo. That is ten minutes of work and it turns a risky beat into a safe one.

**Declare an honest `profile`** (C2): `freshnessDays` reflecting synthesis rather than
observation, `expectedConfidence` genuinely below the live path, `coverage: ["*"]`, and a
`productionPath` naming what would replace it. The ranker is only as honest as the metadata.

## 3. Edge discovery — `src/synthesis/edges.ts`

**Deterministic, no model.** Fuzzy-match creator post captions against business names in the
campaign's target set; emit `mentions` edges with a confidence score.

- Normalise before matching: lowercase, strip punctuation, collapse whitespace, drop common
  suffixes (`salon`, `spa`, `clinic`, `studio`, `pvt ltd`).
- Bengaluru business names often include the locality (*"Bloom Salon, Indiranagar"*) — match on
  the distinctive token, not the whole string.
- Set `confidence` from match quality; store the matched caption as the edge's evidence.

This produces the **warm-intro badge**, and the single clearest proof that the entity graph is
shared across motions rather than three apps in a trench coat. It must find the mentions T2
planted — `creator-03`→`business-01`, `creator-12`→`business-11`, `creator-20`→`business-33`.
Verify against T2's handoff note.

## 4. Creator allocation — `src/synthesis/allocation.ts`

**Deterministic greedy selection**, not an agent. Given scored creators and a `commit_budget` in
**INR**:

1. Sort by fit score per rupee.
2. Greedily select while `commit_budget` remains.
3. **Penalise `audience_overlap`** — selecting two creators with heavy overlap is paying twice
   for the same audience. Discount the marginal value of an overlapping creator before
   re-ranking.
4. Exclude any creator whose rate exceeds `external_spend_commit.max_per_deal`, and **record the
   reason string** — the UI displays it, and *"excluded: ₹1,80,000 exceeds ₹1,00,000 per-deal
   cap"* is a far better demo line than a silently missing row.

Write an `allocation` row: chosen set, per-creator price, total commit, overlap penalty applied,
and a human-readable rationale.

This is a **ranking with visible losers**, exactly like T5's adapter ranking. Keep the excluded
creators in the output with their scores and reasons — same principle, same reason.

All money in **INR**, integer minor units, Indian digit grouping when formatted (₹1,50,000 — not
₹150,000).

## 5. `synthesizeStep` support

Export a clean function T6's workflow calls: dedup targets across motions, run edge discovery,
roll up campaign outcomes.

---

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. Parse at the edge — fixture loads, cache loads, and the generator's model output are all
   parse boundaries. The generated world is validated against `SimWorldSchema` before it is
   cached, never after.
3. **Zero `as`. Zero `any`.**
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **The generated adapter's model call is a network boundary — that one is
   permitted, and it is the only one in this task.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining.
7. Adapters are pure w.r.t. their contract — with the cache warm, the generated adapter is
   genuinely pure. Same input, same output, no model call.

## Done when

- [ ] `pnpm seed` gives a demo-ready DB and is idempotent
- [ ] The generated adapter satisfies all four capability contracts and is chosen by T5's ranker
      when the fixture does not cover the request
- [ ] Cache hit path makes **zero** model calls; same request twice is byte-identical
- [ ] Generated worlds contain **no** signals, scores, or findings — artifacts only
- [ ] Cache pre-warmed for at least two off-script asks
- [ ] Edge discovery finds every mention T2 planted, and produces no false positives on the
      other 57 businesses
- [ ] Allocation respects `commit_budget`, applies the overlap penalty, and excludes over-rate
      creators **with a stated reason**, keeping them visible in the output
- [ ] Allocation and edge discovery are unit-tested as pure functions with no database
- [ ] All INR formatted with Indian digit grouping
- [ ] `grep -rn " as \| any" src/synthesis src/adapters/generated scripts` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially which edges are found in the demo campaign so T10 can script around
them, and which off-script objectives are pre-warmed in the cache.)_
