# MotionGrid — Agentic GTM OS · Parallel Build Plan

## Context

`/Users/ranger/projects/motion-grid` contains only `docs/PLAN.md`. This revision restructures
the build for **parallel execution by 4–6 agents over 1–2 days** on a new stack:
**Next.js + Mastra + Postgres**.

Two constraints drive the structure:

1. **Contracts before code.** Every module boundary is a Zod schema defined once, up front,
   in `src/contracts/`. Agents code against known input and output types, so there is no
   defensive casting and no speculative error handling. This is also exactly how Mastra
   works — every `createStep` declares `inputSchema` / `outputSchema` — so the contract layer
   and the workflow layer are the same layer.
2. **No two agents write the same file.** Ownership is assigned per directory below.

### Decisions taken

| Decision | Choice | Consequence |
|---|---|---|
| Stack | Next.js App Router + Mastra v1 + Postgres | Heavier setup than Bun/SQLite; scope trimmed accordingly |
| LLM access | **Pure Mastra** model router | Anthropic-specific features (citations, task budgets, advisor tool, fast mode, mid-conversation tool changes, programmatic tool calling) are **out** — see *Evidence verification* below for the substitute |
| Postgres | Self-hosted; Apple container locally | One shared DB, **one migration owner** (T0) |
| Timeline | 1–2 days, 4–6 parallel agents | Creator is plan-only; allocation is deterministic, not agentic |

### Decisions taken after T3 (2026-08-08)

| Decision | Choice | Consequence |
|---|---|---|
| Demo focus | **Orchestration** — how the decision gets made | T5's slot reassigned to the orchestrator; the plan screen becomes the hero; ranking must be visible, not implied |
| Adapter selection | Model sets weights, **deterministic code ranks** | Auditable and reproducible; needs adapter `profile` metadata (C2) and ≥2 candidates per ranked capability |
| Market data | Committed fixture **plus** a cached `generated` adapter | Off-script objectives work; determinism and offline both survive; the ranker gains a real choice |
| `consumer.ads` | Declined at plan time, not executed | One reasoned refusal replaces a whole workflow branch |
| Mock UI layer | **Cut** | T9 builds once against real endpoints; one recorded-replay file is the only fixture |
| Pre-T0 code | **Deleted** (`packages/domain\|database\|policy`, `apps/agent-runtime/**`) | Three competing sources of truth for types collapse to one |
| Live integrations | **Relocated, not deleted** — `packages/integrations` → `src/adapters/live/` | Working Twilio + Resend adapters keep their proven logic and join the sim and generated adapters under one ownership path |

---

## Product thesis (unchanged)

AI-drafted first-touch reply rates fell from 3–5% in 2024 to **under 1% by mid-2026**. The
problem isn't the writing — it's that there's no reason to reply.

**Evidence, not personalization tokens.** Every outreach sentence traces to a source excerpt
that is *validated against the source document before it is persisted*.

**One graph, many motions.** A single objective fans out to creator, business, and consumer
motions sharing an entity graph — so a creator who already posted about a target business
becomes a warm intro path. Structurally impossible in a single-motion tool.

### Evidence verification — the substitute for citations

Pure Mastra means we can't use Anthropic's citations API, so excerpts are model-transcribed.
We recover most of the guarantee deterministically and at zero API cost:

```
1. agent.generate(documents, { structuredOutput: { schema: SignalArraySchema } })
2. for each returned signal:
     normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim()
     verified  = normalize(sourceDoc).includes(normalize(signal.excerpt))
3. persist verified signals; drop the rest; record droppedCount on the assessment
```

Fuzzy enough to survive reformatting, strict enough to catch invention. The claim becomes
*"every excerpt is validated against its source before it's persisted — an invented quote is
dropped, and we show you the count."* Surfacing `droppedCount` in the UI is more honest than
the citations version and costs ~20 lines.

---

## Scope

**Revised after T3.** The demo's centre of gravity is **how a decision gets made**, not how many
motions execute. What follows reflects that.

| | In |
|---|---|
| **Decides** | Motion selection, capability selection, and **ranked adapter binding** with every candidate scored and every loser's reason recorded — plus **re-planning when the harness refuses** |
| **Executes fully** | `business.local` — discover → evidence → qualify → contact → draft → **live send** → reply |
| **Plans + allocates** | `creator` — seeded index, scored, deterministic roster under budget |
| **Declined on stage** | `consumer.ads`, `business.online`, `consumer.email` — registered motions the orchestrator visibly refuses, with reasons |
| **Cross-motion** | Shared budget split, shared graph, discovered `mentions` edges → warm-intro badge |
| **Cut for time** | Ledger screen, separate roster screen, follow-up waves, auth, multi-tenancy, **mock UI layer**, **`consumer.ads` execution** |

An orchestrator that refuses work it cannot justify is more credible than one that always says
yes. `consumer.ads` declined with *"no first-party customer data source is connected"* is a
better forty seconds than a fourth branch quietly producing an estimate — and it costs a
sentence instead of a workflow.

---

## Engineering rules — every agent follows these

1. **One source of truth for types.** `src/contracts/` holds every Zod schema. Entity schemas
   are derived from the Drizzle schema with `drizzle-zod`, never hand-duplicated. Import
   inferred types (`z.infer<typeof X>`); never redeclare an interface that a schema already
   describes.
2. **Parse at the edge, trust inside.** Validate exactly three places: HTTP request bodies,
   LLM structured output, and fixture loads. Everywhere downstream, the type is known.
3. **Zero `as` casts. Zero `any`.** `unknown` appears only at a parse boundary. If you reach
   for a cast, the contract is wrong — fix the contract, and say so in your handoff note.
4. **try/catch in exactly three places:** inside a step running under `.parallel()` or
   `.foreach()` (Mastra collapses the whole block on an uncaught throw), at the network
   boundary in a live adapter, and in an API route handler. Nowhere else.
5. **Errors are values inside the pipeline.** Steps return
   `{ ok: true, data } | { ok: false, reason }`. Downstream steps filter on `ok`. No
   exceptions as control flow.
6. **No defensive optional chaining.** If a field can be absent, the schema says
   `.optional()`. If the schema says it's there, it's there.
7. **Adapters are pure w.r.t. their contract.** Given the same input they return the same
   typed output. No hidden I/O, no global state.

---

## Object model

`campaign` is the aggregate root and persists across runs.

```
workspace
  └── campaign                    durable · named · budgeted · pausable
        ├── objective             NL ask + compiled CampaignSpec
        ├── plan[]                versioned
        ├── motion_allocation[]   per-motion budget slice + dependsOn[]
        ├── run[]                 kind: discovery | outreach | follow_up | replan
        ├── target[]              deduped at campaign scope
        ├── edge[]                the graph's edges
        ├── budget                operating + commit — never summed
        └── outcome               rollup
```

### Tables

`workspace` · `campaign` · `objective` · `plan` · `motion_allocation` · `run` · `target` ·
`edge` · `contact` · `signal` · `assessment` · `allocation` · `message` · `interaction` ·
`tool_call` · `policy` · `approval` · `suppression`

**Three target kinds** cover every motion:

```
organization → business.local, business.online
person       → creator (relationship: prospect_partner)
               consumer.email (relationship: customer)
segment      → consumer.ads
```

**`signal.evidence_kind` is per-signal, not per-motion** — Creator Motion has both:

| kind | payload |
|---|---|
| `documentary` | `source_ref, excerpt, verified: boolean, implication, strength` |
| `statistical` | `metric, value, baseline, method, window, implication, strength` |

**`edge`** is what makes it a graph: `from_target, to_target, kind, evidence_id, confidence`.
Kinds: `mentions · employed_by · competitor_of · same_owner · audience_overlap · customer_of`.

**Two budgets, never summed — and in different currencies.** We operate from Bengaluru:

| Budget | What | Currency | Magnitude |
|---|---|---|---|
| `operating` | inference, data, delivery | **USD** (vendor-billed) | cents to a few dollars |
| `commit` | creator fees, ad spend | **INR** (paying Indian creators) | ₹thousands to ₹lakhs |

Stored as `{ amountMinor, currency }` — integer minor units, never floats. No FX conversion;
display each natively with Indian digit grouping for INR (₹1,50,000, not ₹150,000). The
two-currency split was already non-summable; now they aren't even the same unit.

---

## Motion registry

A motion is a declaration, not a code path.

```ts
defineMotion('business.local', {
  targetKind:    'organization',
  discovery:     ['geo.query'],
  observation:   ['web.fetch', 'reviews.fetch'],
  rubric:        localB2BRubric,
  contactModel:  'individual',
  channels:      ['email', 'whatsapp'],
  allocation:    false,
  terminalState: 'meeting_booked',
  consentPolicy: 'legitimate_interest',
})
```

| Motion | Target | Discovery | Allocation | Demo depth |
|---|---|---|---|---|
| `creator` | person | `db.query` creator index | **yes** | plan + roster |
| `business.local` | organization | `geo.query` | no | **full execution** |
| `business.online` | organization | `db.query` company index | no | registered, not run |
| `consumer.ads` | segment | `segment.build` | budget split | plan only |
| `consumer.email` | person | trigger on customer base | no | registered, not run |

Only two fields force branching in the engine: `allocation` and `contactModel: 'none'`.

---

## Capability registry

A capability is a Zod contract, not a vendor. Each is exposed to Mastra as a tool via
`createTool`, so agents select capabilities and the registry resolves the bound adapter.

| Capability | Demo adapters | Modes | Production path |
|---|---|---|---|
| `geo.query` | `sim/market`, `generated/market` | sim, generated | Outscraper, Google Places |
| `db.query` | `sim/index` | sim | Apollo, Modash |
| `web.fetch` | `sim/market`, `generated/market` | sim, generated | Firecrawl |
| `reviews.fetch` | `sim/market`, `generated/market` | sim, generated | Outscraper, Yelp |
| `people.find` | `sim/market`, `generated/market` | sim, generated | Apollo, Hunter |
| `segment.build` | `sim/cohort` | sim | first-party warehouse |
| `message.send` | `twilio` (whatsapp), `resend` (email) | **live** | unchanged |
| `ads.plan` | `sim/estimator` | plan | Google Ads API |

There is **one** `message.send` capability with a `channel` field, not one per channel — see
`contracts/enums.ts`.

**This table is the go-to-prod answer, and it is now something the audience watches rather than
something we assert.** Multiple adapters behind one contract means T5's ranker has a real choice
to make, and the plan screen renders that choice as a ranked table with scores and reasons.
Adding Outscraper is another row in that table.

### The `generated` adapter — runtime market synthesis

The committed fixture covers six Bengaluru localities and six categories. An objective outside
that — *"dental clinics in Pune"* — used to return nothing. The `generated` adapter (T8) fills
the gap behind the same contracts, with a disk cache keyed by `(geography, category, limit,
seed)`:

- **Cache hit** → cached world, zero model calls, byte-identical to last time.
- **Cache miss** → one model call, validated against `SimWorldSchema`, cached, returned.

So determinism survives, offline survives, and the demo can take a request from the room. The
sim adapter still wins the ranking whenever the fixture covers the ask — it is free and
instant, and the ranker is honest about that.

**The hard rule holds for both: the generator emits artifacts, never signals.** Break it and the
evidence pipeline is a puppet show.

### The synthetic market — Bengaluru

Generated once at build time, committed as JSON. Instant, deterministic, survives dead wifi.

- **60 businesses** across Indiranagar, Koramangala, HSR Layout, Jayanagar, Whitefield and
  JP Nagar — salons & spas, derma clinics, dental clinics, boutique gyms and yoga studios,
  pet clinics, speciality cafés. Indian names, `+91` numbers.
- **Reviews** mix praise with specific operational complaints in the register Indian Google
  Maps reviews actually use — *"booked on their site, they had no record"*, *"called 4 times,
  no response"*, *"no online booking, had to DM on Instagram."* That last one is itself a
  qualifying signal: bookings living in Instagram DMs means the website isn't working.
- **Websites** templated across quality tiers with defects genuinely in the markup: missing
  `<meta viewport>`, `© 2019`, no booking link, phone only inside an image.
- **24 creators** — Bengaluru beauty/wellness/lifestyle on Instagram and YouTube, with
  **INR rate cards** (nano ₹3–8k, micro ₹15–40k, mid ₹60k–₹1.5L per reel). Seed 2–3 with post
  captions mentioning businesses in the target set so the `mentions` edge is real.

**WhatsApp is the primary channel, not email.** Indian local SMBs transact on WhatsApp, so
`business.local.channels` is `['whatsapp', 'email']` in that order and drafts are written as
WhatsApp messages — short, no subject line, no signature block.

**Hard rule: the generator emits artifacts, never signals.** No `signal` row is ever written
by the seeder. Break this and the demo is a puppet show.

---

## Pipeline (Mastra workflows)

```
campaignWorkflow
  .then(compileObjectiveStep)        Opus-tier agent → CampaignSpec (structuredOutput)
  .then(planStep)                    orchestrator → motions, DECLINED motions,
                                     RANKED bindings, dual budget, policies
  .then(approvalGate)                suspend() → resume on human approve
  .parallel([                        motion fan-out, failure isolated per motion
     businessLocalWorkflow,
     creatorWorkflow,
  ])                                 consumer.ads is declined at plan time, not run
  .then(synthesizeStep)              edge discovery, dedup, rollup
  .commit()

  on refusal (binding unresolvable | budget denied):
     → replan → re-rank under the new constraint → rebind → continue
     capped at two, then fail with a stated reason

businessLocalWorkflow
  .then(discoverStep)                one call, not per-target
  .foreach(targetWorkflow, { concurrency: 8 })
  .commit()

targetWorkflow                       nested → each target completes independently
  .then(observeStep)                 snapshot + reviews from fixtures, no model
  .then(extractEvidenceStep)         agent → signals → deterministic verification
  .then(assessStep)                  input is ONLY signals, never raw pages
  .branch([[isFit, contactStep], [notFit, terminalStep]])
  .then(draftStep)                   per-sentence evidence_id tagging
  .then(policyGateStep)              deterministic → require_approval
  .commit()
```

**Three model calls per target.** Assessment reasons over evidence, never over raw pages, so
it cannot smuggle in an unverified claim.

**Agent boundary rule:** agents where reasoning is open-ended (objective compilation, planning,
**ranking weights**, evidence, drafting, reply classification). Deterministic code everywhere
else — ranking itself, allocation, edge discovery, policy, budget. Sixty targets is *not* sixty
agents.

### How a decision gets made

This is the product, so the split inside a decision matters as much as the boundary around it:

> **The model decides what matters. Deterministic code decides who wins, and shows its work.**

For every capability, the model returns four weights — cost, freshness, confidence, coverage —
derived from the objective, plus one sentence explaining them. Deterministic code then scores
every candidate adapter against its declared `profile`, sums the weighted dimensions, and picks
the highest eligible score, breaking ties by `adapterId`.

The persisted `RankedBinding` holds **every** candidate with its scores and the reason it won or
lost. That array is what the plan screen renders.

An LLM picking a vendor is unauditable and irreproducible; you cannot answer *"why that one?"*
and you cannot promise the same answer tomorrow. This split answers both with a number and a
sentence, and it is the better engineering regardless of the demo.

### Target state machine

```
discovered → observed → scored ─┬→ not_fit         (terminal, stays visible)
                                └→ fit → contact_found → draft_ready
                                          → pending_approval → sent
                                          → delivered → engaged | suppressed
```

`not_fit` rows staying visible matters — an agent visibly *rejecting* leads with reasons is
more credible than sixty green rows.

---

## Repository layout & file ownership

**No two tasks write the same path.** `src/contracts/` is written by T0, amended once by C2,
and read-only for everyone else at all times.

```
motion-grid/
├── docker-compose.yml                    T0
├── drizzle.config.ts                     T0
├── package.json · tsconfig*.json         T0 → C1
├── apps/web/
│   ├── app/
│   │   ├── layout.tsx · page.tsx         T9
│   │   ├── campaigns/**                  T9
│   │   └── api/**                        T7   (campaigns · stream · messages · webhooks)
│   ├── components/**                     T9
│   └── lib/**                            T7   (twilio-webhook, mastra-client)
├── src/
│   ├── contracts/**                      T0 → C2 amends once → frozen
│   ├── db/
│   │   ├── schema.ts                     T0 → C2 (migration owner)
│   │   └── repositories/**               T1
│   ├── capabilities/**                   T3  (adapter.ts touched by C2)
│   ├── orchestrator/**                   T5  ← selection, ranking, re-plan
│   ├── adapters/sim/**                   T2  (profiles added by C2)
│   ├── adapters/generated/**             T8  ← runtime market synthesis + cache
│   ├── adapters/live/**                  C1 relocates → T7 owns
│   │                                     twilio-whatsapp.ts · resend-email.ts (working today)
│   ├── sim/**                            T2  (generator + fixtures)
│   ├── motions/**                        T4
│   ├── policy/** · ledger/**             T3  (one fix each by C2)
│   ├── evidence/**                       T6
│   ├── synthesis/**                      T8
│   └── mastra/
│       ├── index.ts                      T0 stub → T6 owns
│       ├── agents/** · tools/**          T4
│       └── workflows/**                  T6
├── scripts/**                            T8
└── docs/
    ├── PLAN.md          ← authoritative for the build
    ├── PRODUCT.md       ← original product doc; PLAN.md wins on conflict
    └── tasks/{C,T}*.md
```

**Deleted by C1:** `packages/domain`, `packages/database`, `packages/policy` and
`apps/agent-runtime/**` — pre-T0 code declaring a three-motion enum, a second `PolicyDecision`
and a third `CampaignRepository`, none of it typechecked. Three sources of truth is three too
many.

**Relocated by C1, not deleted:** `packages/integrations` held ~184 lines of *working* Twilio
and Resend adapters against the real SDKs. They move to `src/adapters/live/` as a pure rename —
alongside the sim and generated adapters, where the ownership table always put them — and
`packages/` disappears. The live delivery path is the one thing in this repo that has been
proven against a real phone; it does not get rewritten.

`src/mocks/**` is never created; the mock-UI task is cut.

---

## Task graph

```
        ┌──────────────── T0 contracts + scaffold (BLOCKING) ────────────────┐
        │                                                                    │
   ┌────┴────┬──────────┬──────────┬──────────┐                             │
   T1 db     T2 sim     T3 caps/   T4 agents                                 │
   repos     world      policy     + motions                                 │
   └────┬────┴─────┬────┴─────┬────┴─────┬────┘                             │
        │          │          │          │                                  │
        └──────────┴────┬─────┴──────────┘                                  │
                        │                                                    │
              ┌─────────┴─────────┐                                          │
              C1 cleanup     C2 contracts (BLOCKING for Wave 2)              │
              └─────────┬─────────┘                                          │
        ┌──────────┬────┴─────┬──────────┐                                  │
        T5 orch    T6 wf +    T7 api +   T8 seed + generated                │
        + ranking  evidence   live       + synthesis                        │
        └──────────┴────┬─────┴──────────┘                                  │
                        │                                                    │
                        └────────── T9 UI ──────┴── T10 rehearse ───────────┘
```

### Wave 0 — blocking · 1 agent · ~1.5h

**T0 · Scaffold + contracts**
Next.js App Router, TS strict, Tailwind, Biome, `docker-compose.yml` (Postgres + pgvector),
Drizzle config, full `src/db/schema.ts`, initial migration, `@mastra/pg` storage wired, a
Mastra instance stub, and **all of `src/contracts/`**:

```
contracts/enums.ts        motion ids, target kinds, statuses, channels,
                          evidence kinds, edge kinds, policy decisions
contracts/entities.ts     drizzle-zod derived, one per table
contracts/capabilities.ts I/O schema per capability
contracts/steps.ts        I/O schema per Mastra step
contracts/api.ts          request/response + SSE event union
contracts/index.ts        barrel
```

*Done when:* `pnpm build` and `pnpm typecheck` pass, `drizzle-kit push` applies against the
container, and a smoke test imports every schema and parses one fixture of each.
**Nothing else starts until this is green.**

### Wave 1 — 5 agents parallel · ~4h

| Task | Owns | Deliverable | Done when |
|---|---|---|---|
| **T1 · Data layer** | `src/db/repositories/**` | One typed repository per aggregate (`campaignRepo`, `targetRepo`, `signalRepo`, `edgeRepo`…). Query + write functions only, no business logic | Unit tests round-trip every entity; no `as` in the diff |
| **T2 · Sim world** | `src/sim/**`, `src/adapters/sim/**` | `generate.ts` producing committed fixtures (60 businesses, 24 creators, 2–3 seeded `mentions`); all six sim adapters implementing their capability contracts | Every adapter's output parses against its contract; fixtures committed; generator is seed-deterministic |
| **T3 · Capabilities, policy, ledger** | `src/capabilities/**`, `src/policy/**`, `src/ledger/**` | Registry + adapter binding + resolution; policy engine returning `allow \| deny \| require_approval` with reason; dual-currency cost ledger with shadow costs | Policy decision table is unit-tested exhaustively; ledger arithmetic tested in both currencies |
| **T4 · Agents & motions** | `src/mastra/agents/**`, `src/mastra/tools/**`, `src/motions/**` | Five `defineMotion` declarations + rubrics; Mastra agents (objective compiler, planner, evidence, drafter, reply classifier) with `structuredOutput` schemas; capabilities wrapped as `createTool` | Each agent callable standalone with a fixture input and returns schema-valid output |
*(T5's original mock-UI task is cut — see Wave 1.5 and T9.)*

### Wave 1.5 — 2 agents parallel · ~1.5h · added after T3

| Task | Owns | Deliverable | Done when |
|---|---|---|---|
| **C1 · Repo cleanup** | `packages/**`, `apps/agent-runtime/**`, root configs | Delete the pre-T0 architecture; **relocate the working Twilio/Resend adapters to `src/adapters/live/`**; one Next app at `apps/web`; `pnpm typecheck` covers it; a real `pnpm test`; `plan.md` → `docs/PRODUCT.md` | No `@motiongrid/*` imports remain; `git diff --find-renames` shows the provider files as **pure renames**; typecheck proven to cover `apps/web` |
| **C2 · Contract amendment** | `src/contracts/**` + one migration | Adapter `profile` metadata, `generated` mode, `RankedBinding`, declined-motion and re-plan fields, structured budget warning, `ads.plan` unit fix, orchestration SSE events | Every addition optional or defaulted so **T4's current output still parses**; existing policy tests pass unchanged; contracts re-frozen |

**C2 blocks Wave 2.** It is the one deliberate unfreeze, it is small, and it has a single owner
precisely so it does not become five silent edits.

### Wave 2 — 4 agents parallel · ~4h

| Task | Owns | Deliverable | Done when |
|---|---|---|---|
| **T5 · Orchestrator** | `src/orchestrator/**` | Motion selection with declines; capability narrowing; **model-weighted, deterministically-scored adapter ranking** keeping every loser with its reason; re-plan on binding failure or budget denial | Ranking is deterministic and unit-tested with zero model calls; a budget denial mid-run rebinds and continues; malformed weights rejected, not normalised |
| **T6 · Workflows + evidence** | `src/mastra/workflows/**`, `src/evidence/**`, `src/mastra/index.ts` | `campaignWorkflow`, per-motion workflows, nested `targetWorkflow`; evidence step with **deterministic excerpt verification**; approval gate via `suspend`/`resume`; re-plan trigger and resumption | Full 60-target run completes against sim adapters with zero errors; every persisted signal passes verification; every capability call goes through `executeCapability` |
| **T7 · API, live delivery, webhooks** | `apps/web/app/api/**`, `apps/web/lib/**`, `src/adapters/live/**` | Route handlers, SSE stream, **adopt** the existing Twilio + Resend routes behind `message.send`, inbound webhook → reply classifier → `interaction` | One WhatsApp and one email actually deliver; inbound reply writes an `interaction`; orchestration events stream as decisions are made |
| **T8 · Seed, generated market, synthesis** | `src/synthesis/**`, `src/adapters/generated/**`, `scripts/**` | Workspace seed; **cached runtime market synthesis** behind the sim contracts; deterministic `mentions` edge discovery; creator allocation (greedy under `commit_budget`, `audience_overlap` penalty) | `pnpm seed` idempotent; cache hits make zero model calls; edge discovery finds the seeded mentions with no false positives; allocation excludes over-rate creators with a stated reason |

### Wave 3 — 1–2 agents · ~4h

**T9 · UI** — build every screen once against real endpoints. The **plan screen is the hero**:
declined motions with reasons, ranked adapter tables with losers, and a visible re-plan. One
recorded-replay file behind `?replay=1` is the only fixture, and it doubles as T10's offline
fallback.

**T10 · Rehearse** — seed, run end-to-end three times, then once with wifi off. Rehearse the
budget-denial re-plan until it is boring. Record a screen capture as the ultimate fallback.

---

## Coordination rules for parallel agents

- **Contracts are frozen after T0.** If a task needs a schema change, it stops and raises it
  rather than editing `src/contracts/` — a silent contract edit breaks every other agent.
- **One migration owner.** Only T0 runs `drizzle-kit`. Wave 1+ agents assume the schema
  exists.
- **Mocks unblock, they don't ship.** T5 builds against mock data so it never waits on the
  backend; T9 removes the mocks.
- **Each task ends with a handoff note** in `docs/tasks/T*.md`: what was built, contract
  gaps found, anything the next wave must know.
- Full self-contained briefs get written to `docs/tasks/` before agents are spawned.

---

## What Mastra gives us — and what it costs

**Gives:** typed step I/O (which is our contract discipline, enforced by the framework),
`.parallel()` for motion fan-out, `.foreach({concurrency})` for the target pipeline, nested
workflows so each target completes independently, `suspend`/`resume` for the human approval
gate, built-in memory, and traces/observability for free — the last is a genuine bonus-points
item, since judges can see the whole agent graph.

**Costs:** the Anthropic-specific capability list is gone. Citations, task budgets, advisor
tool, fast mode, mid-conversation tool changes and programmatic tool calling are all
provider-specific and don't survive the model-router abstraction. Deterministic excerpt
verification replaces citations; prompt caching may work through `providerOptions` but is
unverified — treat it as a bonus, not a plan.

**Verify in hour one (T0):** whether Mastra's model router resolves current Anthropic model
IDs. Docs show `anthropic/claude-sonnet-4-6` and `anthropic/claude-opus-4-7`. If newer IDs
don't resolve, either pin to a supported ID or pass an AI SDK provider instance. This is a
five-minute check that would otherwise surface at hour six.

---

## Demo script (4 minutes)

Reweighted for the orchestration focus — the plan screen now carries the first ninety seconds.

1. **0:00** — "GTM tools got better at writing emails and reply rates fell below 1%. The problem
   isn't the writing — it's that there's no reason to reply. And no tool can tell you why it
   picked what it picked."
2. **0:15** — Type the objective. The plan streams: motions selected, **`consumer.ads` declined
   with its reason**, budget split into operating (USD) vs commit (₹).
3. **0:50** — **The ranked adapter table.** "The model didn't pick the provider. It decided what
   mattered for *this* objective — that's its reasoning, one sentence — and then the ranking is
   deterministic. Every candidate, every score, why each loser lost. Same objective tomorrow,
   same ranking."
4. **1:25** — Approve. The Grid fills with mixed-motion rows. Ticker climbs in two currencies.
5. **1:55** — **Drop the budget mid-run.** Policy denies, the orchestrator re-plans, the binding
   changes on screen, the run continues. "It got told no, and it reasoned its way to a different
   plan instead of throwing."
6. **2:25** — Evidence drawer. "Every excerpt is checked against the source before we store it.
   Two claims got dropped on this lead — you can see the count."
7. **2:50** — Warm-intro badge. "A creator this campaign found already posted about this salon.
   Two motions, one graph. Three separate tools can't do that."
8. **3:10** — Approval queue → approve. **"Check your phone."**
9. **3:35** — Judge replies. Grid flips to `engaged` live.
10. **3:50** — "Market data is simulated. The reasoning, the ranking, the policies, the
    verification, the messages and that WhatsApp are real. And that bottom row in the ranking
    table is Outscraper — swapping to it is a config change, because the agent never knew which
    provider it was talking to."

**Spare thirty seconds?** Take an objective from the room. T8's generated adapter handles a city
nobody rehearsed — but only run this if the cache pre-warm covers it and you have rehearsed the
cache-miss path once.

---

## Risks — start in hour one

| Risk | Mitigation |
|---|---|
| Mastra model router may not resolve current Anthropic IDs | Five-minute check in T0; pin or pass a provider instance |
| Postgres container + Drizzle + Mastra storage is more setup than SQLite | T0 is explicitly blocking and budgeted 1.5h; nobody starts until it's green |
| WhatsApp needs a public webhook URL | `cloudflared tunnel` in hour one |
| Twilio sandbox needs each recipient to text a join phrase | Pre-join the demo phone the night before; **Telegram bot is the 10-minute fallback** |
| **SMS to Indian numbers needs DLT registration** with a telecom operator — days of lead time | **Don't build SMS.** WhatsApp via the Twilio sandbox sidesteps it entirely, and is the channel Indian SMBs actually use |
| Resend on a bare domain only sends to your own address | Exactly the demo case — don't attempt domain verification |
| Parallel agents drifting on contracts | Contracts frozen after T0; **exactly one owned unfreeze (C2)**, additive only, re-frozen on completion; everything else escalates |
| Ranking looks like theatre if every capability has one candidate | Each ranked capability must have ≥2 real candidates with genuinely different profiles — that is why the `generated` adapter earns its place beyond the off-script case |
| Model returns weights that don't sum to 1 | Reject and retry; never normalise silently. A model that can't produce four numbers summing to 1 shouldn't be trusted with the campaign |
| Re-plan loops on stage | Capped at two, then a clean failure with a stated reason. A clean failure beats a loop |
| `executeCapability` has never met a real adapter | Nothing outside `src/capabilities/` imports it yet. **T6 wires one `geo.query` call through the funnel in hour one**, before composing anything |
| Next.js HMR creating duplicate `PostgresStore` instances | Store the instance on `globalThis`, per Mastra's documented guidance |
| Hackathon wifi | Fixtures are local; only Anthropic + Twilio/Resend need network. Record a full run |

---

## Verification

- `pnpm typecheck` clean with **zero `as` casts and zero `any`** across the repo, **including
  `apps/web`** (C1 makes it actually covered) — grep the diff; a cast means a contract is wrong.
- `pnpm test` — capability contract round-trips, motion registry validation, policy decision
  table, dual-currency ledger arithmetic, repository round-trips, **adapter ranking**.
- **Ranking determinism and honesty**: the same spec twice produces identical candidate order
  and identical scores with no model call on the second run, and every `RankedBinding` retains
  every candidate considered with the reason it won or lost.
- **Re-plan**: an operating-budget denial mid-run rebinds to a cheaper adapter and the run
  continues; three forced failures fail cleanly with a stated reason rather than looping.
- **Generated adapter**: a cache hit makes zero model calls and is byte-identical to the
  previous run; no generated world contains a signal, score, or finding.
- **Evidence verification**: every persisted documentary signal satisfies
  `normalize(source).includes(normalize(excerpt))`; the assessment records `droppedCount`.
- **Offline run**: network disabled to sim adapters; a 60-target campaign reaches
  `draft_ready` with zero errors.
- **Determinism**: same objective and seed, twice → identical target set and identical
  signals. Divergence means the sim leaks randomness and the second demo run embarrasses you.
- **Budget**: operating cap $0.50 → run pauses with the policy reason surfaced.
  `external_spend_commit` below a creator's rate → excluded from roster with a stated reason.
- **Live send**: one WhatsApp and one email land; the reply webhook writes an `interaction`
  and the grid updates without a refresh.

---

## Future scope

**Near** — real discovery adapters (Outscraper, Apollo, Modash, Firecrawl); `business.online`
and `consumer.email` execution; CRM write-back; auth and multi-tenancy; follow-up waves.

**Mid** — Creator Motion past outreach: brief → contract → promo code → content approval →
attribution → payment (needs a `collaboration` entity B2B doesn't have). Consumer execution
against Meta/Google. Dynamic budget rebalancing across motions. Motion DAG (`dependsOn`) so
creator content is live before ads amplify it.

**Long** — outcome learning: `interaction` feeds back into scoring so the orchestrator plans
from what converted rather than a static rubric, and edges accumulate into a proprietary
graph that improves every campaign. That is the compounding moat, and it is why the shared
graph and the campaign root exist from day one.
