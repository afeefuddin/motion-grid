# T8 · Seed, Edge Discovery, Creator Allocation

**Wave 2 · parallel with T6, T7 · ~4h · depends on T1, T2, T3**

Two deterministic algorithms and the seed that makes the demo reproducible. Nothing here is an
LLM call — that's deliberate. Allocation and edge discovery are decisions we can compute
exactly, so we should.

## Owned paths (exclusive write)

```
src/synthesis/**
scripts/**
```

## Read-only

`src/contracts/**` (frozen) · `src/db/repositories/**` (T1) · `src/sim/**` (T2) ·
`src/policy|ledger/**` (T3)

Read **T2's handoff note first** — it tells you which creators mention which businesses.

## Forbidden

`src/mastra/**`, `app/**`, `src/adapters/**`.

## Deliverables

### 1. `scripts/seed.ts`

`pnpm seed` produces a demo-ready database:

- **Workspace** — the seller. We're a Bengaluru company selling booking/website software to
  local service businesses. Fill in ICP, proof points, and sender identities (WhatsApp number,
  from-email).
- **Demo campaign preset** so the objective box can be pre-filled on stage rather than typed
  from scratch if time is tight.
- Sim fixtures loaded into `target` rows.

Idempotent — running it twice must not duplicate anything.

### 2. Edge discovery — `src/synthesis/edges.ts`

**Deterministic, no model.** Fuzzy-match creator post captions against business names in the
campaign's target set; emit `mentions` edges with a confidence score.

- Normalise before matching: lowercase, strip punctuation, collapse whitespace, drop common
  suffixes (`salon`, `spa`, `clinic`, `studio`, `pvt ltd`).
- Bengaluru business names often include the locality (*"Bloom Salon, Indiranagar"*) — match
  on the distinctive token, not the whole string.
- Set `confidence` from match quality; store the matched caption as the edge's evidence.

This produces the **warm-intro badge** — demo beat 5, and the single clearest proof that the
entity graph is shared across motions rather than three apps in a trench coat. It must find
the mentions T2 planted. Verify against their handoff note.

### 3. Creator allocation — `src/synthesis/allocation.ts`

**Deterministic greedy selection**, not an agent. Given scored creators and a
`commit_budget` in **INR**:

1. Sort by fit score per rupee.
2. Greedily select while `commit_budget` remains.
3. **Penalise `audience_overlap`** — selecting two creators with heavy overlap is paying twice
   for the same audience. Discount the marginal value of an overlapping creator before
   re-ranking.
4. Exclude any creator whose rate exceeds `external_spend_commit.max_per_deal`, and **record
   the reason string** — T5's UI displays it, and "excluded: ₹1,80,000 exceeds ₹1,00,000
   per-deal cap" is a far better demo line than a silently missing row.

Write an `allocation` row: chosen set, per-creator price, total commit, overlap penalty
applied, and a human-readable rationale.

All money in **INR**, integer minor units, Indian digit grouping when formatted
(₹1,50,000 — not ₹150,000).

### 4. `synthesizeStep` support

Export a clean function T6's workflow calls: dedup targets across motions, run edge discovery,
roll up campaign outcomes.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. Parse at the edge — fixture loads only.
3. **Zero `as`. Zero `any`.**
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **None are in this task.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining.
7. Pure functions — allocation and edge discovery must be unit-testable with no database.

## Done when

- [ ] `pnpm seed` gives a demo-ready DB and is idempotent
- [ ] Edge discovery finds every mention T2 planted, and produces no false positives on the
      other 57 businesses
- [ ] Allocation respects `commit_budget`, applies the overlap penalty, and excludes
      over-rate creators **with a stated reason**
- [ ] Allocation and edge discovery are unit-tested as pure functions
- [ ] All INR formatted with Indian digit grouping
- [ ] `grep -rn " as \| any" src/synthesis scripts` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially which edges are found in the demo campaign, so T10 can script around
them)_
