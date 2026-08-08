# T9 · The UI — built once, against real endpoints

**Wave 3 · ~4h · depends on T5, T6, T7, T8**

> This task absorbed the cut T5. There is **no mock layer** — building screens against mocks
> and then rewiring them was two passes at one screen set and a whole reconciliation surface.
> You build each screen once, against the real endpoint, and the contracts make that safe.

## Owned paths (exclusive write)

```
apps/web/app/**          (everything EXCEPT apps/web/app/api/**)
apps/web/components/**
```

**C1 already deleted `apps/web/components/campaign-workbench.tsx`** — it was the pre-T0 new-campaign
screen, built against a `CampaignPlan` shape that no longer exists. You are building that screen
from scratch, not porting it.

What C1 kept for you: `apps/web/app/globals.css` (862 lines of real design system),
`apps/web/app/layout.tsx`, `apps/web/components/brand-mark.tsx`, and `apps/web/app/page.tsx`
minus its workbench mount. The fonts are already
in `package.json` (Manrope, Newsreader, IBM Plex Mono). Use that styling — it is good, and
rebuilding a visual language is not what these four hours are for.

## Read-only

`src/contracts/**` — **frozen**, and your entire interface to the rest of the system. Especially
`contracts/api.ts`, which defines the SSE event union you render from.

Everything else. **Do not "fix" a backend file to make a screen work** — raise it with whoever
owns that path.

## Forbidden

`apps/web/app/api/**` (T7 owns it) and every `src/` path.

## Read first

T5's handoff (what a ranked binding looks like), T6's (the suspend/resume contract), T7's (the
SSE connection and reconnect behaviour), T8's (which row carries the warm-intro badge).

---

## Screens

| Screen | Contents | Priority |
|---|---|---|
| **New campaign** | one-box objective → streamed spec → editable form | P0 |
| **Plan** | motion cards, **declined motions with reasons**, **ranked adapter tables**, dual-currency cost, policy list, **Approve** | **P0 — this is now the hero** |
| **The Grid** | rows streaming through states, motion column + filter chips, live cost ticker, warm-intro badge | P0 |
| **Evidence drawer** | Proof Graph per target: signal → source → excerpt → implication, plus `droppedCount` | P0 |
| **Approval queue** | draft with sentences linked to evidence; approve / edit / reject | P0 |
| **Campaign list** | name, motions, status, spend (operating USD + commit INR), replies | P1 |

## The Plan screen is the demo

The Grid was the hero when the pitch was execution. The pitch is now **how the decision gets
made**, so the plan screen carries it. Three things must be unmissable:

**1. Declined motions.** `consumer.ads` declined, with its reason, rendered as prominently as
the selected ones — not greyed out in a footnote. A system that visibly refuses work it cannot
justify is more credible than one that always says yes. Same treatment as `not_fit` rows: muted,
never hidden.

**2. Ranked adapter tables.** Per capability, every candidate with its dimension scores, total,
and the reason it won or lost — plus the model's `weightsRationale` quoted verbatim above the
table. Ineligible candidates stay in the table with their reason. Show `profile.productionPath`
on each row: seeing `sim/market` beat `generated/market` beat `outscraper — Outscraper, Google
Places` in one ranked table *is* the go-to-prod argument, made visually.

**3. Re-plan.** When `replan_started` arrives mid-run, the plan visibly changes — old binding
struck through, new one in its place, the trigger reason stated. This is the beat where the
audience sees the system get told *no* and reason its way around it. Do not let it happen
silently in a log.

## The Grid

- Row states: `discovered → observed → scored → {not_fit | fit} → contact_found → draft_ready
  → pending_approval → sent → delivered → engaged`
- **`not_fit` rows stay visible** with their reason. An agent visibly rejecting leads is more
  credible than 60 green rows. Muted, not hidden.
- Sortable by assessment score, so the ranking T6 produced is legible rather than implied.
- Mixed-motion rows in one table with a motion column — that mix *is* the point.
- Cost ticker shows **two currencies side by side, never summed**: operating in USD, commit in
  INR with Indian digit grouping (₹1,50,000).
- **Warm-intro badge** on rows with a `mentions` edge — clicking it shows the linked creator.
- Budget warning banner driven by the **structured** `warning` field C2 added. Do not
  pattern-match the reason string.

## Evidence drawer

Signal list with `source_ref`, `excerpt`, `implication`, `strength`. Show `verified` state and
surface **"N claims dropped as unverifiable"** — that number is a feature, not an error. Show
statistical signals (`metric`, `value`, `baseline`) in a distinct treatment from documentary
ones.

## Streaming and resilience

Real `EventSource` against `GET /api/stream/:runId` from the start. Reconnect handling is not
polish — a dropped connection mid-demo must recover, not freeze at 40 of 60 rows.

Loading and empty states on every screen. An empty grid before a run starts should look
deliberate, not broken.

## Both human gates

**Approve plan** resumes T6's suspended workflow. **Approve message** triggers T7's send. Both
must work end to end; the second one is the *"check your phone"* beat.

## Working before the backend is ready

You depend on four Wave 2 tasks and cannot wait for all of them. Build against the real
endpoints and let them 404 — then keep a **single fixture module** holding one recorded SSE
transcript and one recorded plan payload, both parsed through their contract schemas, behind a
`?replay=1` query flag.

That is not the mock layer we cut. It is one file, it never becomes a second source of truth
because it parses through the same contracts, and it survives into T10 as the offline demo
fallback. If it grows past one file or starts shaping component props, you have rebuilt the
thing we deleted — stop.

## The one thing that can go wrong

If a screen needs data no endpoint returns, the temptation is a cast or a `?? []`. Don't. Rules
3 and 6 exist for exactly this moment. Either the endpoint is wrong or the contract is — find
out which, and say so in your handoff.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`. Never redeclare a props interface a schema
   already describes.
2. Parse at the edge — the replay fixture is a parse boundary; API responses are already
   contract-typed, so don't re-validate everywhere.
3. **Zero `as`. Zero `any`.** No `as unknown as Props`.
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **None are in this task.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining to paper over a missing field.
7. Adapters are pure w.r.t. their contract.

## Done when

- [ ] Every screen runs on real data from real endpoints
- [ ] Plan screen shows declined motions with reasons, and full ranked adapter tables with losers
- [ ] A mid-run re-plan visibly updates the plan screen
- [ ] Grid streams live from SSE, including reconnect, and sorts by score
- [ ] Budget warning renders from the structured `warning` field, not from parsed prose
- [ ] Both approval gates work end to end
- [ ] Cost ticker shows real spend — USD operating, INR commit, separately, Indian digit grouping
- [ ] Warm-intro badge appears from real discovered edges
- [ ] Replay fixture is exactly one file and parses through contract schemas
- [ ] `grep -rn " as \| any" apps/web/app apps/web/components` returns nothing
- [ ] Handoff note written

---

## Handoff note

Implemented 2026-08-08.

- Added the authenticated campaign shell, campaign list, one-box campaign creation flow, plan,
  Grid, evidence drawer, and approval queue under `apps/web/app/campaigns/**`. The landing-page
  calls to action now enter this flow.
- Live campaign detail uses the real campaign endpoints and one `EventSource` for the run. Live
  and replay events pass through the same `projectRun` state projection, including reconnect
  state, costs, targets, evidence, edges, approvals, warnings, and visible re-planning.
- `?replay=1` uses exactly one fixture module. Its campaign payload, plan, and event transcript
  all parse through the frozen contract schemas. It covers plan ranking, declined motions,
  targets, documentary evidence, a warm-intro edge, costs, budget warning, re-plan, and plan
  approval without contacting the backend.
- The frozen contracts do not expose `profile.productionPath` on ranked candidates even though
  this brief asks the UI to render it. `CampaignDetailResponseSchema` also omits assessments,
  signals, edges, approvals, messages, and interactions; SSE can fill those only after the page
  connects. There is no message-detail/update endpoint, so an approval event supplies a policy
  reason and message ID but not the evidence-linked draft needed for editing. The UI does not
  invent those values: score sorting, dropped-claim totals, provider production paths, and draft
  editing remain blocked on contract/API additions.
- Verification: repository TypeScript passes and Next production compilation passes. The build
  then hits a Next 16/Node 26 internal `/_global-error` prerender invariant after compilation.
  No unit tests were added or run, per instruction.
