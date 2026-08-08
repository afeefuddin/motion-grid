# T1 · Data Layer

**Wave 1 · parallel with T2–T5 · ~4h · depends on T0**

Typed repositories over the Drizzle schema. **No business logic** — that lives in T3 (policy,
ledger) and T6 (workflows). You are the only agent writing database access code; everyone
else calls your functions.

## Owned paths (exclusive write)

```
src/db/repositories/**
src/db/client.ts
```

## Read-only

`src/db/schema.ts` and `src/contracts/**` — **frozen**. If you need a column or schema change,
**stop and escalate**; do not edit them.

## Forbidden

`src/adapters/`, `src/mastra/`, `apps/web/app/`, `src/policy/`, `src/ledger/`.

## Deliverables

### `src/db/client.ts`
Drizzle client over `DATABASE_URL`. Store on `globalThis` so Next.js HMR doesn't open a new
pool per reload.

### One repository per aggregate

```
campaignRepo   create · byId · list · updateStatus · updateBudgetSpend
objectiveRepo  create · byCampaign
planRepo       create (versioned) · latestByCampaign · approve
runRepo        create · byCampaign · updateStatus
targetRepo     bulkUpsert (dedup by campaign + natural key) · byCampaign
               · updateState · byState
contactRepo    create · byTarget
signalRepo     bulkCreate · byTarget · byCampaign
assessmentRepo create · byTarget
edgeRepo       bulkCreate · byCampaign · byTarget
allocationRepo create · byCampaign
messageRepo    create · byTarget · pendingApproval · approve · markSent
interactionRepo create · byTarget · byCampaign
toolCallRepo   create · byRun · costByCampaign
suppressionRepo isSuppressed · add
workspaceRepo  get · seed
```

Each function takes and returns contract types. No repository returns a raw Drizzle row type
where a contract type exists.

### Notes that matter

- **`targetRepo.bulkUpsert` dedups at campaign scope.** A follow-up run must not re-create a
  target discovered in the first run. Natural key: `(campaign_id, kind, external_ref)`.
- **`campaignRepo.updateBudgetSpend` takes two currencies.** `operating` and `commit` are
  separate columns and must never be summed into one.
- **`signalRepo.bulkCreate` writes the `verified` flag as given.** Verification is T6's job;
  you persist the boolean, you don't compute it.
- Use transactions where a write spans tables (e.g. assessment + signals).

## Tests

Round-trip every entity: insert → read → assert deep-equal against the contract schema.
Cover `bulkUpsert` dedup and the two-currency budget update explicitly.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`, `drizzle-zod`-derived.
2. Parse at the edge, trust inside.
3. **Zero `as`. Zero `any`.** A cast means the contract is wrong — escalate.
4. try/catch only in: a step under `.parallel()`/`.foreach()`, a live-adapter network call,
   an API route handler. **None of those are in this task — so no try/catch here.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining.
7. Adapters are pure w.r.t. their contract.

## Done when

- [ ] Every entity round-trips in a test
- [ ] `bulkUpsert` dedup verified
- [ ] Two-currency budget update verified
- [ ] `grep -rn " as \| any" src/db/repositories` returns nothing
- [ ] Handoff note written

---

## Handoff note

Completed 2026-08-08.

- Added an HMR-safe Drizzle client over `DATABASE_URL`. The Drizzle instance and its
  postgres.js pool share one `globalThis` entry; one-shot processes can call
  `closeDatabase()` to release the pool.
- Added contract-parsed repositories for all 18 persisted entities, including the
  `motion_allocation`, `policy`, and `approval` tables omitted from the abbreviated
  deliverable list. Repository inserts accept types inferred from the frozen
  `New*Schema` contracts, and entity reads parse through their frozen `*Schema` contracts.
- `targetRepo.bulkUpsert` removes duplicate natural keys within an incoming batch and uses
  the database `(campaign_id, kind, external_ref)` conflict target across runs. Rediscovery
  updates relationship/name/payload but preserves workflow state; callers use
  `updateState` for explicit transitions.
- `campaignRepo.updateBudgetSpend(id, operating, commit)` updates operating USD cents and
  commit INR paise independently. It performs no summing or currency conversion.
- `planRepo.create` can atomically persist motion allocations, and
  `assessmentRepo.create` can atomically persist its signals. Signal payloads, including
  the caller-provided documentary `verified` boolean, are stored unchanged after contract
  parsing.
- Added Postgres integration coverage for all entities and every public operation. The
  suite explicitly verifies incoming and cross-run target deduplication, separate currency
  updates, false `verified` persistence, graph lookup from either endpoint, aggregate tool
  cost, message transitions, and suppression lookup. It passes with:
  `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/motiongrid pnpm exec tsx
  --test src/db/repositories/repositories.test.ts`.
- `pnpm typecheck`, `pnpm build`, Biome checks, and the required repository grep for casts
  and `any` all pass.
