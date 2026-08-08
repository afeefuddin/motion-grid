# T5 · UI (against mocks)

**Wave 1 · parallel with T1–T4 · ~4h · depends on T0**

Build every screen against contract-shaped mock data. **You must not wait on the backend** —
none of it exists yet. T9 swaps your mocks for real endpoints later.

## Owned paths (exclusive write)

```
app/**          (everything EXCEPT app/api/**)
components/**
src/mocks/**
```

## Read-only

`src/contracts/**` — **frozen**, and it is your entire interface to the rest of the system.
Especially `contracts/api.ts`, which defines the SSE event union you render from.

## Forbidden

`app/api/**` (T7 owns it) and every `src/` path except `src/mocks/`.

## Deliverables

### Screens

| Screen | Contents | Priority |
|---|---|---|
| **Campaign list** | name, motions, status, spend (operating USD + commit INR), replies | P1 |
| **New campaign** | one-box objective → streamed spec → **editable form** | P0 |
| **Plan** | motion cards, capability bindings, dual-currency cost, policy list, editable budget split, **Approve** | P0 |
| **The Grid** | **hero screen** — rows streaming through states, motion column + filter chips, live cost ticker, warm-intro badge | P0 |
| **Evidence drawer** | Proof Graph per target: signal → source → excerpt → implication, plus **`droppedCount`** | P0 |
| **Approval queue** | draft with sentences linked to evidence; approve / edit / reject | P0 |

### The Grid is the demo

Everything else supports it. It must look good with 60 rows streaming in over ~35 seconds.

- Row states: `discovered → observed → scored → {not_fit | fit} → contact_found →
  draft_ready → pending_approval → sent → delivered → engaged`
- **`not_fit` rows stay visible** with their reason. An agent visibly rejecting leads is more
  credible than 60 green rows. Style them muted, not hidden.
- Mixed-motion rows in one table with a motion column — that mix *is* the point.
- Cost ticker shows **two currencies side by side, never summed**: operating in USD, commit
  in INR with Indian digit grouping (₹1,50,000).
- **Warm-intro badge** on rows that have a `mentions` edge — clicking it shows the linked
  creator. This is a demo beat; make it visually obvious.

### Evidence drawer

Signal list with `source_ref`, `excerpt`, `implication`, `strength`. Show `verified` state and
surface **"N claims dropped as unverifiable"** — that number is a feature, not an error. Show
statistical signals (`metric`, `value`, `baseline`) in a distinct treatment from documentary
ones.

### `src/mocks/**`

A mock SSE emitter that replays a realistic run against the event union in `contracts/api.ts`
— with timing, so you can actually judge the streaming feel. Mock entities must be Bengaluru
data (salons, derma clinics, Indiranagar/Koramangala) with ₹ rate cards, so the visual design
is tested against real-shaped content rather than Lorem Ipsum.

## Constraints

- Every mock object is typed by a contract schema. If a screen needs a field the contract
  doesn't have, **stop and escalate** — do not invent a shape T9 will have to reconcile.
- Keep the mock boundary in exactly one module so T9's swap is a single import change.
- Tailwind. No component library that fights a custom grid.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`. Never redeclare a props interface a
   schema already describes.
2. Parse at the edge — mock loads are a parse boundary.
3. **Zero `as`. Zero `any`.** No `as unknown as Props`.
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **None are in this task.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining — if the schema says the field is there, render it.
7. Adapters are pure w.r.t. their contract.

## Done when

- [ ] All six screens render from mocks with no backend running
- [ ] Grid handles 60 streaming rows without jank
- [ ] Cost display shows USD and INR separately, correctly formatted for India
- [ ] Every mock validates against a contract schema in a test
- [ ] Mock boundary isolated to one module
- [ ] `grep -rn " as \| any" app components src/mocks` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially: the mock module T9 must replace, and any contract field you wished
existed)_
