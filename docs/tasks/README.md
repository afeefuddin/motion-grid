# Task Briefs

Each file in this directory is a **self-contained brief**. An agent should be able to be
handed one file and nothing else.

Read `../PLAN.md` only if you need product context. The brief is authoritative for scope.

## Wave order

```
        ┌──────────── T0 contracts + scaffold (BLOCKING) ────────────┐
        │                                                            │
   ┌────┴────┬──────────┬──────────┬──────────┐                     │
   T1 db     T2 sim     T3 caps/   T4 agents                         │
   repos     world      policy     + motions                         │
   └────┬────┴─────┬────┴─────┬────┴─────┬────┘                     │
        │          │          │          │                          │
        └──────────┴────┬─────┴──────────┘                          │
                        │                                            │
              ┌─────────┴─────────┐                                 │
              C1 cleanup    C2 contract amendment (BLOCKING for W2) │
              └─────────┬─────────┘                                 │
        ┌───────────┬───┴────────┬────────────┐                     │
        T5 orch     T6 workflows T7 api+live  T8 seed +             │
        + ranking   + evidence   + webhooks   generated + synthesis │
        └───────────┴────┬───────┴────────────┘                     │
                         └──── T9 UI ────┴── T10 rehearse ──────────┘
```

| Wave | Tasks | Parallel | Budget | Status |
|---|---|---|---|---|
| 0 | T0 | no — blocking | ~1.5h | done |
| 1 | T1 T2 T3 T4 | 4 agents | ~4h | T1–T3 done · T4 in flight |
| 1.5 | C1 C2 | 2 agents | ~1.5h | **C2 blocks Wave 2** |
| 2 | T5 T6 T7 T8 | 4 agents | ~4h | |
| 3 | T9 T10 | 1–2 agents | ~4h | |

### What changed after T3

- **The demo focus moved to orchestration.** How a decision gets made — motion selection,
  capability selection, ranked adapter binding, and re-planning when the harness refuses — is
  the product. T5's slot was reassigned to it.
- **T5's mock-UI task is cut.** Building screens against mocks and rewiring them in T9 was two
  passes at one screen set. T9 now builds the UI once against real endpoints, with a single
  recorded-replay file as the offline fallback.
- **`consumer.ads` execution is cut.** It is now *declined at plan time with a stated reason*,
  which is a better demo beat than a fourth branch producing an estimate.
- **C1 and C2 are new.** C1 removes the pre-T0 architecture still sitting in `packages/**` and
  `apps/agent-runtime/**`, which contradicts `src/contracts/`. C2 is the single owned contract
  unfreeze that ranking needs. Contracts freeze again the moment C2 lands.
- **The UI lives at `apps/web/`,** not the repo root. C1 corrects every brief that says
  otherwise.

## Non-negotiables

1. **Contracts are frozen after T0**, with exactly one exception: **C2**, which owns a single
   additive amendment and re-freezes them on completion. Everyone else, before and after:
   **stop and escalate**. Do not edit `src/contracts/` or `src/db/schema.ts` — a silent edit
   breaks five agents.
2. **Only T0 and C2 run migrations.** Everyone else assumes the schema exists.
3. **Write only inside your owned paths.** Every brief lists them explicitly.
4. **End with a handoff note** appended to your own brief file: what you built, contract
   gaps you hit, what the next wave must know.

## The seven engineering rules

Every brief repeats these. They exist because the user explicitly asked for known
inputs/outputs and minimal casting and error handling.

1. **One source of truth for types.** All schemas live in `src/contracts/`. Entity schemas
   are `drizzle-zod`-derived, never hand-duplicated. Import `z.infer<typeof X>`; never
   redeclare an interface a schema already describes.
2. **Parse at the edge, trust inside.** Validate in exactly three places: HTTP request
   bodies, LLM structured output, fixture loads. Downstream, the type is known.
3. **Zero `as` casts. Zero `any`.** `unknown` only at a parse boundary. Reaching for a cast
   means the contract is wrong — escalate it.
4. **try/catch in exactly three places:** inside a step under `.parallel()`/`.foreach()`
   (Mastra collapses the whole block on an uncaught throw), at the network boundary in a
   live adapter, and in an API route handler. Nowhere else.
5. **Errors are values inside the pipeline.** Return `{ ok: true, data } | { ok: false,
   reason }`. Downstream filters on `ok`. No exceptions as control flow.
6. **No defensive optional chaining.** If a field can be absent the schema says
   `.optional()`. If the schema says it's there, it's there.
7. **Adapters are pure w.r.t. their contract.** Same input → same typed output. No hidden
   I/O, no global state.
