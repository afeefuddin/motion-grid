# T0 · Contracts + Scaffold — **BLOCKING**

**Wave 0 · 1 agent · ~1.5h · nothing else starts until this is green**

You are laying the foundation every other agent builds on. Five agents are blocked on you.
Optimise for *correct, complete contracts* over features — there is no application logic in
this task at all.

## Owned paths (exclusive write)

```
package.json · tsconfig.json · apps/web/next.config.ts · biome.json · .gitignore · .env.example
docker-compose.yml
drizzle.config.ts
src/contracts/**
src/db/schema.ts
src/mastra/index.ts          (stub only — T6 takes ownership later)
```

## Forbidden

Everything else. Do not create `src/adapters/`, `src/motions/`, `apps/web/app/` screens, or any
repository. Other agents own those and will collide with you.

## Stack

Next.js (App Router) · TypeScript **strict** · Tailwind · Biome · Drizzle + `drizzle-zod` ·
Postgres (Apple container locally) · Mastra v1 + `@mastra/pg` · Zod.

## Deliverables

### 1. Scaffold

- Next.js App Router app that builds clean. `tsconfig.json` with `strict: true`,
  `noUncheckedIndexedAccess: true`.
- `docker-compose.yml` — Postgres 17 with `pgvector`. Document the Apple-container command
  in the README if it differs.
- `.env.example` with every var the project will need:
  `DATABASE_URL`, `ANTHROPIC_API_KEY`, `TWILIO_*`, `RESEND_API_KEY`, `PUBLIC_WEBHOOK_URL`.

### 2. `src/db/schema.ts` — all 18 tables

`workspace` · `campaign` · `objective` · `plan` · `motion_allocation` · `run` · `target` ·
`edge` · `contact` · `signal` · `assessment` · `allocation` · `message` · `interaction` ·
`tool_call` · `policy` · `approval` · `suppression`

Notes that matter:

- `campaign` is the aggregate root; `target` and `edge` are campaign-scoped.
- `target.kind`: `organization | person | segment`. `target.relationship`:
  `prospect | prospect_partner | customer`. Typed payload as `jsonb`.
- `edge`: `from_target, to_target, kind, evidence_id, confidence`. Kinds:
  `mentions · employed_by · competitor_of · same_owner · audience_overlap · customer_of`.
- `signal.evidence_kind`: `documentary | statistical` — **discriminated payload**.
  Documentary: `source_ref, excerpt, verified (bool), implication, strength`.
  Statistical: `metric, value, baseline, method, window, implication, strength`.
- `campaign.budget` and `motion_allocation` carry **two separate currencies**:
  `operating_*` (cents) and `commit_*` (cents). **Never a single summed column.**
- `assessment` has `dropped_count` (int) — unverified excerpts discarded by T6.
- `run.kind`: `discovery | outreach | follow_up | re_engagement | replan`.

Generate the initial migration and apply it. **You are the only agent who runs
`drizzle-kit`.**

### 3. `src/contracts/**` — the keystone

```
contracts/enums.ts         motion ids, target kinds, relationships, campaign/target/run
                           statuses, channels, evidence kinds, edge kinds,
                           policy decisions, adapter modes
contracts/entities.ts      drizzle-zod derived select + insert schemas, one per table
contracts/capabilities.ts  input + output schema per capability (list below)
contracts/steps.ts         input + output schema per Mastra step (list below)
contracts/api.ts           route request/response schemas + the SSE event union
contracts/index.ts         barrel export
```

**Capabilities** (`geo.query`, `db.query`, `web.fetch`, `reviews.fetch`, `people.find`,
`segment.build`, `message.send`, `ads.plan`) each need an input schema, an output schema,
and a declared unit cost shape.

**Steps** (`compileObjective`, `plan`, `discover`, `observe`, `extractEvidence`, `assess`,
`findContact`, `draft`, `policyGate`, `synthesize`, `classifyReply`) each need input and
output schemas. Pipeline steps return the discriminated result:

```ts
export const StepResult = <T extends z.ZodTypeAny>(data: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true),  data }),
    z.object({ ok: z.literal(false), reason: z.string() }),
  ])
```

**SSE event union** in `contracts/api.ts` — T5 builds the UI against this before any backend
exists, so it must be complete: `plan.delta`, `target.state`, `cost.tick`, `signal.added`,
`edge.discovered`, `approval.required`, `message.sent`, `interaction.received`, `run.done`.

### 4. `src/mastra/index.ts` — stub

Mastra instance with `PostgresStore`. **Store it on `globalThis`** — Next.js HMR otherwise
creates duplicate instances (documented Mastra guidance). No agents, no workflows; T6 takes
this file over.

## Hour-one verification — report this in your handoff

Mastra's docs show router strings `anthropic/claude-opus-4-7` and
`anthropic/claude-sonnet-4-6`. **Check whether current model IDs resolve.** If they don't,
pin to a supported ID or pass an AI SDK provider instance, and say which you chose. This is
a five-minute check that otherwise surfaces at hour six for someone else.

## The seven engineering rules

1. One source of truth for types — schemas in `src/contracts/`, `drizzle-zod`-derived, never
   hand-duplicated.
2. Parse at the edge, trust inside — HTTP bodies, LLM output, fixture loads only.
3. Zero `as`. Zero `any`. `unknown` only at a parse boundary.
4. try/catch in exactly three places: a step under `.parallel()`/`.foreach()`, a live-adapter
   network call, an API route handler.
5. Errors are values inside the pipeline — `{ok, data} | {ok, reason}`.
6. No defensive optional chaining — the schema decides what's optional.
7. Adapters are pure w.r.t. their contract.

## Done when

- [x] `pnpm typecheck` and `pnpm build` pass
- [x] `drizzle-kit push` applies cleanly against the container
- [x] A smoke test imports every exported schema and parses one example of each
- [x] `src/contracts/index.ts` exports everything the other ten tasks need
- [x] Mastra model-router finding documented below
- [x] Handoff note written

---

## Handoff note

Completed 2026-08-08.

- Built the pnpm/Next.js/TypeScript/Biome/Tailwind scaffold, Postgres 17 + pgvector container
  definition, Drizzle configuration and initial migration, and the HMR-safe Mastra stub using
  `PostgresStore` on `globalThis`.
- Added exactly 18 application tables. UUIDs are the public identifiers; timestamps are
  timezone-aware. Targets deduplicate on `(campaign_id, kind, external_ref)`. Edges are
  campaign-scoped and prevent self-links. Monetary amounts are non-negative integer minor
  units: operating columns are USD cents and commit columns are INR paise despite the legacy
  `_cents` suffix in the task contract; they must never be summed or FX-converted.
- `target.payload` and `signal.payload` are discriminated at the Zod contract layer. Database
  JSONB remains storage-only; consumers must use the derived entity schemas. Documentary and
  statistical evidence cannot be mixed, and `AssessInputSchema` accepts signals rather than
  source documents, preserving the evidence firewall.
- All eight capabilities declare input, output, and `{ unit, operatingCents, commitCents }`
  unit-cost schemas. All eleven steps use `{ ok: true, data } | { ok: false, reason }`. The
  API contract includes all route boundaries and the complete nine-event SSE union.
- `pnpm contracts:smoke` imports the barrel and parses an example for every exported Zod
  schema (167 schemas at handoff). `pnpm typecheck` and `pnpm build` pass.
- Generated `drizzle/0000_black_speed_demon.sql`; `drizzle-kit migrate` applied cleanly to a
  fresh database with all 18 tables and the `vector` extension, and `drizzle-kit push --force`
  also applied cleanly
  to a fresh `pgvector/pgvector:pg17` instance. Docker Compose uses port 5432. Verification
  used Apple container port 5433 because another local Postgres already occupied 5432:
  `container run --name motiongrid-postgres -e POSTGRES_DB=motiongrid -e
  POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 -d
  docker.io/pgvector/pgvector:pg17`.
- Mastra model-router finding: installed `@mastra/core` 1.57.0's generated provider registry
  contains both `anthropic/claude-opus-4-7` and `anthropic/claude-sonnet-4-6`; current Mastra
  documentation also demonstrates Sonnet 4.6. Use those router strings directly. No AI SDK
  provider instance or fallback pin is required.
- Wave 1 must not assume database JSONB values are already parsed when bypassing the entity
  schemas, that nullable foreign keys are present, or that operating and commit minor units
  share a currency.
