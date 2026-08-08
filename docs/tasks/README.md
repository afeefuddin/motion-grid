# Task Briefs

Each file in this directory is a **self-contained brief**. An agent should be able to be
handed one file and nothing else.

Read `../PLAN.md` only if you need product context. The brief is authoritative for scope.

## Wave order

```
        ┌──────────── T0 contracts + scaffold (BLOCKING) ────────────┐
        │                                                            │
   ┌────┴────┬──────────┬──────────┬──────────┬──────────┐          │
   T1 db     T2 sim     T3 caps/   T4 agents  T5 UI                  │
   repos     world      policy     + motions  (mocks)                │
   └────┬────┴─────┬────┴─────┬────┴─────┬────┴─────┬────┘          │
        └──────────┴────┬─────┴──────────┘          │               │
              ┌─────────┴─────────┬──────────────┐  │               │
              T6 workflows        T7 api + live  T8 seed +          │
              + evidence          + webhooks     synthesis          │
              └─────────┬─────────┴──────┬───────┘                  │
                        └──── T9 wire UI ─┴── T10 rehearse ─────────┘
```

| Wave | Tasks | Parallel | Budget |
|---|---|---|---|
| 0 | T0 | no — blocking | ~1.5h |
| 1 | T1 T2 T3 T4 T5 | 5 agents | ~4h |
| 2 | T6 T7 T8 | 3 agents | ~4h |
| 3 | T9 T10 | 1–2 agents | ~2h |

## Non-negotiables

1. **Contracts are frozen after T0.** If you need a schema change, **stop and escalate**.
   Do not edit `src/contracts/` or `src/db/schema.ts` — a silent edit breaks five agents.
2. **Only T0 runs migrations.** Everyone else assumes the schema exists.
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
