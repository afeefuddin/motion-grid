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
| Timeline | 1–2 days, 4–6 parallel agents | Creator/Consumer are plan-only; allocation is deterministic, not agentic |

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

| | In |
|---|---|
| **Executes fully** | `business.local` — discover → evidence → qualify → contact → draft → **live send** → reply |
| **Plans + allocates** | `creator` — seeded index, scored, deterministic roster under budget |
| **Plans only** | `consumer.ads` — segment + ad plan with cost estimate |
| **Cross-motion** | Shared budget split, shared graph, discovered `mentions` edges → warm-intro badge |
| **Cut for time** | Ledger screen, separate roster screen, replay, follow-up waves, `business.online` and `consumer.email` execution, auth, multi-tenancy |

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

| Capability | Demo adapter | Mode | Production path |
|---|---|---|---|
| `geo.query` | `sim/market` | sim | Outscraper, Google Places |
| `db.query` | `sim/index` | sim | Apollo, Modash |
| `web.fetch` | `sim/market` | sim | Firecrawl |
| `reviews.fetch` | `sim/market` | sim | Outscraper, Yelp |
| `people.find` | `sim/market` | sim | Apollo, Hunter |
| `segment.build` | `sim/cohort` | sim | first-party warehouse |
| `message.send:whatsapp` | `twilio` | **live** | unchanged |
| `message.send:email` | `resend` | **live** | unchanged |
| `ads.plan` | `sim/estimator` | plan-only | Google Ads API |

**This table is the go-to-prod answer** — swap the adapter, the contract and the agent are
untouched.

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
  .then(planStep)                    → Plan: motions, bindings, dual budget, policies
  .then(approvalGate)                suspend() → resume on human approve
  .parallel([                        motion fan-out, failure isolated per motion
     businessLocalWorkflow,
     creatorWorkflow,
     consumerAdsWorkflow,
  ])
  .then(synthesizeStep)              edge discovery, dedup, rollup
  .commit()

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

**Agent boundary rule:** agents where reasoning is open-ended (objective compilation,
planning, evidence, drafting, reply classification). Deterministic code everywhere else —
allocation, edge discovery, policy, budget. Sixty targets is *not* sixty agents.

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

**No two tasks write the same path.** `src/contracts/` is written by T0 and thereafter
read-only for everyone.

```
motion-grid/
├── docker-compose.yml                    T0
├── drizzle.config.ts                     T0
├── app/
│   ├── layout.tsx · page.tsx             T5
│   ├── campaigns/**                      T5
│   └── api/
│       ├── campaigns/**                  T7
│       ├── stream/**                     T7
│       └── webhooks/**                   T7
├── components/**                         T5
├── src/
│   ├── contracts/**                      T0  ← read-only for all others
│   ├── db/
│   │   ├── schema.ts                     T0  ← read-only for all others
│   │   └── repositories/**               T1
│   ├── capabilities/**                   T3
│   ├── adapters/sim/**                   T2
│   ├── adapters/live/**                  T7
│   ├── sim/**                            T2  (generator + fixtures)
│   ├── motions/**                        T4
│   ├── policy/** · ledger/**             T3
│   ├── evidence/**                       T6
│   ├── synthesis/**                      T8
│   └── mastra/
│       ├── index.ts                      T0 stub → T6 owns
│       ├── agents/** · tools/**          T4
│       └── workflows/**                  T6
└── docs/
    ├── PLAN.md
    └── tasks/T*.md
```

---

## Task graph

```
        ┌──────────────── T0 contracts + scaffold (BLOCKING) ────────────────┐
        │                                                                    │
   ┌────┴────┬──────────┬──────────┬──────────┬──────────┐                  │
   T1 db     T2 sim     T3 caps/   T4 agents  T5 UI                          │
   repos     world      policy     + motions  (mocks)                        │
   └────┬────┴─────┬────┴─────┬────┴─────┬────┴─────┬────┘                  │
        │          │          │          │          │                       │
        └──────────┴────┬─────┴──────────┘          │                       │
                        │                            │                       │
              ┌─────────┴─────────┬──────────────┐   │                       │
              T6 workflows        T7 api+live    T8 seed+synthesis           │
              + evidence          + webhooks                                 │
              └─────────┬─────────┴──────┬───────┘                           │
                        │                │                                    │
                        └────── T9 wire UI ──────┴── T10 rehearse ────────────┘
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
| **T5 · UI** | `app/**` (non-api), `components/**` | Campaign list, new-campaign, plan screen, **the Grid**, evidence drawer, approval queue — all against contract-shaped mock data | Every screen renders from mocks; no backend dependency; SSE event union consumed from a mock emitter |

### Wave 2 — 3 agents parallel · ~4h

| Task | Owns | Deliverable | Done when |
|---|---|---|---|
| **T6 · Workflows + evidence** | `src/mastra/workflows/**`, `src/evidence/**`, `src/mastra/index.ts` | `campaignWorkflow`, per-motion workflows, nested `targetWorkflow`; evidence step with **deterministic excerpt verification**; approval gate via `suspend`/`resume` | Full 60-target run completes against sim adapters with zero errors; every persisted signal passes verification |
| **T7 · API, live delivery, webhooks** | `app/api/**`, `src/adapters/live/**` | Route handlers, SSE stream endpoint, Twilio WhatsApp + Resend adapters behind `message.send`, inbound webhook → reply classifier → `interaction` | One WhatsApp and one email actually deliver; inbound reply writes an `interaction` row |
| **T8 · Seed, synthesis, demo data** | `src/synthesis/**`, `scripts/**` | Workspace seed, demo campaign preset, deterministic `mentions` edge discovery (fuzzy caption↔business-name match), creator allocation (greedy under `commit_budget` with `audience_overlap` penalty) | `pnpm seed` gives a demo-ready DB; edge discovery finds the seeded mentions; allocation respects budget and excludes over-rate creators with a stated reason |

### Wave 3 — 1–2 agents · ~2h

**T9 · Wire UI** — replace T5's mocks with real endpoints and the live SSE stream. Owns the
diff in `app/**` and `components/**`; must not change contracts.

**T10 · Rehearse** — seed, run end-to-end three times, then once with wifi off. Fix what
breaks. Record a screen capture as the ultimate fallback.

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

1. **0:00** — "GTM tools got better at writing emails and reply rates fell below 1%. The
   problem isn't the writing — it's that there's no reason to reply."
2. **0:15** — Type the objective. Plan streams: three motions, budget split into operating vs
   commit, policy list, approval gate.
3. **1:00** — Approve. The Grid fills with mixed-motion rows. Ticker climbs.
4. **1:40** — Evidence drawer. "Every excerpt is checked against the source before we store
   it. Two claims got dropped on this lead — you can see the count."
5. **2:25** — Warm-intro badge. "A creator this campaign found already posted about this
   salon. Two motions, one graph. Three separate tools can't do that."
6. **2:50** — Approval queue → approve. **"Check your phone."**
7. **3:25** — Judge replies. Grid flips to `engaged` live.
8. **3:45** — "Market data is simulated. The reasoning, policies, verification, messages and
   that WhatsApp are real. Swapping the sim adapter for Outscraper is one line."

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
| Parallel agents drifting on contracts | Contracts frozen after T0; changes escalate, never edited silently |
| Next.js HMR creating duplicate `PostgresStore` instances | Store the instance on `globalThis`, per Mastra's documented guidance |
| Hackathon wifi | Fixtures are local; only Anthropic + Twilio/Resend need network. Record a full run |

---

## Verification

- `pnpm typecheck` clean with **zero `as` casts and zero `any`** across the repo — grep the
  diff; a cast means a contract is wrong.
- `pnpm test` — capability contract round-trips, motion registry validation, policy decision
  table, dual-currency ledger arithmetic, repository round-trips.
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
