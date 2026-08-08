# T6 · Mastra Workflows + Evidence Verification

**Wave 2 · parallel with T5, T7, T8 · ~4h · depends on T1, T2, T3, T4, C2**

The execution spine. You compose everything the earlier waves built into runnable workflows,
and you own the one piece of logic that makes the product's central claim true.

**Changed since the first draft:** the plan step now calls T5's orchestrator rather than
emitting a plan itself; `consumerAdsWorkflow` is gone from the fan-out (it is declined at plan
time); and the workflow must handle a mid-run re-plan.

## Owned paths (exclusive write)

```
src/mastra/workflows/**
src/evidence/**
src/mastra/index.ts          (taken over from T0)
```

## Read-only

`src/contracts/**` (frozen again after C2) · `src/orchestrator/**` (T5) ·
`src/motions/**` and `src/mastra/agents|tools/**` (T4) ·
`src/capabilities|policy|ledger/**` (T3) · `src/db/repositories/**` (T1) ·
`src/adapters/**` (T2, T8)

**Read every handoff note before you start — especially T5's**, which names the plan and
re-plan entry points you call.

## Forbidden

`apps/web/**` (T7, T9), `src/synthesis/**` (T8), `src/orchestrator/**` (T5), anything else.

---

## Deliverables

### 1. Workflow composition

```ts
campaignWorkflow
  .then(compileObjectiveStep)     agent → CampaignSpec
  .then(planStep)                 calls T5's orchestrator → PlanData with
                                  ranked bindings + declined motions
  .then(approvalGate)             suspend() → resume on human approve
  .parallel([                     motion fan-out, failure isolated per motion
     businessLocalWorkflow,
     creatorWorkflow,
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
what lets each target finish its full pipeline independently instead of producing nested arrays
and lockstep waves.

`consumerAdsWorkflow` is **not** in the fan-out. `consumer.ads` is declined during planning with
a stated reason, and that decline renders on the plan screen. Do not add the branch back.

### 2. Every capability call goes through the funnel

`planStep` returns `RankedBinding`s. Execution resolves each one with T3's `resolveBinding` and
calls `executeCapability` — **never an adapter directly**. That funnel parses both boundaries,
computes billable units, and awaits the ledger write before returning, so no step can obtain an
unledgered result.

`resolveBinding` deliberately fails rather than substituting a different provider. When it
fails, that is not an error to swallow — it is the re-plan trigger in deliverable 6.

Note that as of this task, `executeCapability` and `bindCapability` have **never been exercised
against a real adapter** — nothing outside `src/capabilities/` imports them. Wiring them up is
your first integration risk, not your last. Do it in hour one with a single `geo.query` call
before composing anything else.

### 3. Evidence verification — `src/evidence/**`

This replaces Anthropic's citations API (unavailable through Mastra's model router) and is what
keeps "every excerpt traces to its source" true rather than decorative.

```ts
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// for each signal returned by the evidenceExtractor agent:
const verified = normalize(sourceDoc).includes(normalize(signal.excerpt))
```

- Persist verified signals with `verified: true`.
- **Drop unverified ones** and increment `assessment.droppedCount`.
- Never persist an unverified documentary signal — an invented quote must not reach the UI.

`droppedCount` is surfaced in the evidence drawer as *"N claims dropped as unverifiable."* That
is a demo beat, not an error state.

### 4. The evidence firewall

`assessStep` receives **only the verified signals** — never the raw HTML or review text. This is
a wiring constraint, and it's load-bearing: it makes it structurally impossible for the scoring
step to introduce a claim that was never verified. Do not "helpfully" pass the source document
through for context.

### 5. Approval gate

Use Mastra `suspend()` / `resume()`. The workflow parks; T7's API resumes it when a human
approves. Persist enough state that a resume after a process restart still works.

The plan presented at this gate must include the ranked bindings and the declined motions — the
human is approving a **decision**, not a task list.

### 6. Re-plan — the new control path

T5 owns the re-planning logic; you own the trigger and the resumption.

Two triggers:

- `resolveBinding` fails — the planned adapter is unavailable
- `evaluatePolicies` returns `deny` on `operating_budget_cap` mid-run

On either, emit `replan_started`, call T5's re-plan entry point with the refusal as a
constraint, and resume the affected motion against the new bindings. Already-completed targets
keep their results; do not restart the run.

Cap it at T5's limit (two re-plans), then fail the run with the stated reason. A re-plan loop on
stage is worse than a clean failure.

### 7. Error handling — the one place it belongs

Rule 4 permits try/catch inside steps running under `.parallel()` or `.foreach()`, and this task
is where that applies. Mastra collapses an entire parallel block on an uncaught throw, so each
motion workflow and each target step catches its own failure and returns `{ ok: false, reason }`.
Downstream steps filter on `ok`. One bad target must not kill the run; one failed motion must
not kill the campaign.

---

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

- [x] `executeCapability` proven end to end against a sim adapter **in hour one**
- [ ] A 60-target `business.local` run completes against sim adapters with **zero errors**
- [x] Every capability call goes through `executeCapability`; no adapter is called directly
- [x] Every persisted documentary signal passes verification; `droppedCount` is recorded
- [x] `assessStep` provably never receives raw source documents
- [x] Approval gate suspends and resumes correctly, and the approved plan carries ranked bindings
- [x] A forced `resolveBinding` failure triggers a re-plan and the run continues
- [x] A mid-run operating-budget denial triggers a re-plan and the run continues
- [x] Re-plan is capped; the third attempt fails with a stated reason
- [ ] A deliberately failing target does not abort the run; a failing motion does not abort the campaign
- [x] Run works with the network disabled to sim adapters
- [ ] Same objective + same seed twice → identical targets and identical signals
- [x] `grep -rn " as \| any" src/mastra/workflows src/evidence` returns nothing
- [x] Handoff note written

---

## Handoff note

Completed 2026-08-08.

- `createDefaultCampaignWorkflow()` builds and `src/mastra/index.ts` registers
  `campaignWorkflow`. Its input is `{ workspaceId, campaignId, runId, planId, workspaceName,
  objective, budget }`. `plan-step` calls T5's `planCampaign`; contact enrichment that T5 marks
  deferred is ranked and promoted to an approved `people.find` binding before the gate. The
  fan-out contains only `business-local-workflow` and `creator-workflow`; declined motions,
  including `consumer.ads`, remain in the plan shown for approval.
- T7 resumes step ID `approval-gate` with
  `{ approved: boolean, reviewerId: string }`. The suspend payload is
  `{ reason, plan, approval }`, where `plan` includes every ranked candidate, chosen binding, policy,
  declined capability, and declined motion. Mastra's configured `PostgresStore` persists the
  snapshot, so `campaignWorkflow.createRun({ runId }).resume(...)` can recover it after restart.
- `business-local-workflow` makes one discovery call and feeds a committed nested
  `target-workflow` to `.foreach(..., { concurrency: 8 })`. The complete target pipeline is one
  failure boundary returning `{ ok: false, targetId, reason }`; creator is independently isolated
  under `.parallel()`. Synthesis receives successful target IDs only.
- Documentary verification lives in `src/evidence/verify.ts`. It matches excerpts only against
  the document named by `sourceRef`, using lowercase/whitespace normalization, drops mismatches,
  and persists retained documentary payloads with `verified: true`. Assessment serialization
  accepts signals and `droppedCount` but has no source-document field, forming the evidence
  firewall. Drafts are persisted with one evidence ID per generated sentence and remain
  `pending_approval`.
- T7 can pass a `WorkflowEventSink` to `createDefaultCampaignWorkflow(events)`. Re-planning emits
  `replan_started`, `replan_completed`, or `replan_exhausted`; every event includes
  `campaignId`, `runId`, `trigger`, `reason`, and one-based `attempt`. Binding refusals include
  the capability and unavailable adapter when calling T5. Completed target IDs are carried as a
  constraint, concurrent refusals share one in-flight re-plan, and attempt three returns the
  stated limit reason.
- The first real `executeCapability` integration exposed T2's pre-C2 adapter shape
  (`adapterId/capability/execute(input)`). T6 normalizes those adapters once in
  `sim-adapters.ts`; the geo proof then parsed both boundaries, returned the sim output, computed
  record units, and awaited the ledger writer before the test could observe completion.
- Verification completed with `pnpm typecheck`, production `pnpm build`, Biome on all T6-owned
  paths, the zero-cast grep, 44 non-database tests, and 51 tests against a temporary PostgreSQL
  database. Coverage includes the real sim
  `geo.query` funnel, source-specific quote rejection, durable suspend/resume, failed-motion
  isolation, binding-failure recovery, operating-budget re-planning, completed-target retention,
  and the two-attempt cap. The dedicated 60-target workflow run and full-run determinism check
  remain separate rehearsal checks.
