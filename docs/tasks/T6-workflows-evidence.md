# T6 · Mastra Workflows + Evidence Verification

**Wave 2 · parallel with T7, T8 · ~4h · depends on T1, T2, T3, T4**

The execution spine. You compose everything Wave 1 built into runnable workflows, and you own
the one piece of logic that makes the product's central claim true.

## Owned paths (exclusive write)

```
src/mastra/workflows/**
src/evidence/**
src/mastra/index.ts          (taken over from T0)
```

## Read-only

`src/contracts/**` (frozen) · `src/motions/**` and `src/mastra/agents|tools/**` (T4) ·
`src/capabilities|policy|ledger/**` (T3) · `src/db/repositories/**` (T1) ·
`src/adapters/sim/**` (T2)

**Read every Wave 1 handoff note before you start.**

## Forbidden

`app/**` (T5/T7), `src/synthesis/**` (T8), anything owned above.

## Deliverables

### 1. Workflow composition

```ts
campaignWorkflow
  .then(compileObjectiveStep)     agent → CampaignSpec
  .then(planStep)                 → Plan: motions, bindings, dual budget, policies
  .then(approvalGate)             suspend() → resume on human approve
  .parallel([                     motion fan-out, failure isolated per motion
     businessLocalWorkflow,
     creatorWorkflow,
     consumerAdsWorkflow,
  ])
  .then(synthesizeStep)           calls T8's synthesis module
  .commit()

businessLocalWorkflow
  .then(discoverStep)             one call, not per-target
  .foreach(targetWorkflow, { concurrency: 8 })
  .commit()

targetWorkflow                    nested → each target completes independently
  .then(observeStep)              snapshot + reviews from fixtures, no model
  .then(extractEvidenceStep)      agent → signals → VERIFY → persist
  .then(assessStep)               input is ONLY signals, never raw pages
  .branch([[isFit, contactStep], [notFit, terminalStep]])
  .then(draftStep)                per-sentence evidence_id tagging
  .then(policyGateStep)           deterministic → require_approval
  .commit()
```

Use a **nested workflow** inside `.foreach()`, not a chain of `.foreach()` calls — nesting is
what lets each target finish its full pipeline independently instead of producing nested
arrays and lockstep waves.

### 2. Evidence verification — `src/evidence/**`

This replaces Anthropic's citations API (unavailable through Mastra's model router) and is
what keeps "every excerpt traces to its source" true rather than decorative.

```ts
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// for each signal returned by the evidenceExtractor agent:
const verified = normalize(sourceDoc).includes(normalize(signal.excerpt))
```

- Persist verified signals with `verified: true`.
- **Drop unverified ones** and increment `assessment.droppedCount`.
- Never persist an unverified documentary signal — an invented quote must not reach the UI.

`droppedCount` is surfaced in the evidence drawer as *"N claims dropped as unverifiable."*
That is a demo beat, not an error state.

### 3. The evidence firewall

`assessStep` receives **only the verified signals** — never the raw HTML or review text. This
is a wiring constraint, and it's load-bearing: it makes it structurally impossible for the
scoring step to introduce a claim that was never verified. Do not "helpfully" pass the source
document through for context.

### 4. Approval gate

Use Mastra `suspend()` / `resume()`. The workflow parks; T7's API resumes it when a human
approves. Persist enough state that a resume after a process restart still works.

### 5. Error handling — the one place it belongs

Rule 4 permits try/catch inside steps running under `.parallel()` or `.foreach()`, and this
task is where that applies. Mastra collapses an entire parallel block on an uncaught throw, so
each motion workflow and each target step catches its own failure and returns
`{ ok: false, reason }`. Downstream steps filter on `ok`. One bad target must not kill the
run; one failed motion must not kill the campaign.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. Parse at the edge — LLM structured output is a parse boundary.
3. **Zero `as`. Zero `any`.**
4. try/catch in exactly three places — **this task owns the first one**: steps under
   `.parallel()`/`.foreach()`. Nowhere else, not even "just in case".
5. **Errors are values** — `{ ok, data } | { ok, reason }`.
6. No defensive optional chaining.
7. Adapters are pure w.r.t. their contract.

## Done when

- [ ] A 60-target `business.local` run completes against sim adapters with **zero errors**
- [ ] Every persisted documentary signal passes verification; `droppedCount` is recorded
- [ ] `assessStep` provably never receives raw source documents
- [ ] Approval gate suspends and resumes correctly
- [ ] A deliberately failing target does not abort the run; a failing motion does not abort
      the campaign
- [ ] Run works with the network disabled to sim adapters
- [ ] Same objective + same seed twice → identical targets and identical signals
- [ ] `grep -rn " as \| any" src/mastra/workflows src/evidence` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially the suspend/resume contract T7 needs, and the SSE events you emit)_
