# MotionGrid — Agentic GTM OS

## Context

`/Users/ranger/projects/motion-grid` is an empty git repo. MotionGrid turns a business
objective into an auditable, executable, multi-motion campaign. One orchestrator, one entity
graph, one adapter layer, N motions.

**Target: a hackathon demo built in 1–2 days.** Constraints agreed:

- **No production data APIs.** Discovery and enrichment run against a synthetic market we
  generate and commit as fixtures. The demo is about the agentic layer, not vendor plumbing.
- **Outbound delivery is real.** The agent sends actual WhatsApp and email to seeded demo
  contacts during the pitch, and handles the reply.
- **One motion executes end-to-end; all motions plan.** Business/local runs the full pipeline
  to a live send. Creator produces a costed roster. Consumer produces an ad plan.

The line we hold and say out loud: **we simulate the market, not the agent.** Every signal,
score, allocation and message comes from real model reasoning over the synthetic corpus.
Nothing is pre-baked.

---

## Product thesis

Clay is enrichment plumbing. Unify is signal→outbound. 11x is an autonomous SDR. All three
optimize for *more personalized volume*, and the market has already priced that in:
AI-drafted first-touch reply rates fell from 3–5% in 2024 to **under 1% by mid-2026**, with
buying committees block-listing known AI-SDR signatures.

Two things make MotionGrid different, and both are demonstrable in four minutes:

**1. Evidence, not personalization tokens.** Every outreach sentence traces to a cited
artifact — a verbatim review quote, a missing booking link, a stale copyright year. We
enforce this with the Claude citations API rather than a prompt instruction, so the model
*cannot* invent a quote. Local B2B is the right beachhead precisely because its buying
signals are publicly observable and provable.

**2. One graph, many motions.** A single objective fans out to creator, business, and
consumer motions that share an entity graph — so a creator who already posted about a
target business becomes a warm intro path. That cross-motion edge is structurally impossible
in a single-motion tool, and it is the answer to "why a platform instead of three tools."

---

## Scope

| | Ships in the demo |
|---|---|
| **Executes fully** | `business.local` — discover → evidence → qualify → contact → draft → **live send** → reply |
| **Plans + allocates** | `creator` — discovers from a seeded index, scores, proposes a roster under budget |
| **Plans only** | `consumer.ads` — builds a segment and an ad plan with cost estimate |
| **Cross-motion** | Shared budget split, shared graph, discovered edges between creator and business targets |
| **Out of scope** | Real discovery APIs, Google Ads execution, CRM sync, multi-tenancy, auth |

---

## Object model

`campaign` is the aggregate root. Everything hangs off it and persists across runs.

```
workspace                         seller identity, ICP, proof points, sender profiles
  └── campaign                    durable · named · budgeted · pausable · resumable
        ├── objective             the NL ask (revisable → new plan version)
        ├── plan[]                versioned; v1 approved, v2 after re-plan
        ├── motion_allocation[]   per-motion budget slice + dependsOn[]
        ├── run[]                 waves: discovery · outreach · follow_up · replan
        ├── target[]              accumulates across runs, deduped at campaign scope
        ├── edge[]                the graph's edges — see below
        ├── budget                operating + commit (see Cost model)
        └── outcome               replies, meetings, roster signed, cost per outcome
```

### Tables

| Table | Notes |
|---|---|
| `workspace` | What we sell, ICP, proof points, sender identities per channel |
| `campaign` | Root. `status: draft → planned → approved → running ⇄ paused → completed` |
| `objective` | Raw NL + compiled `CampaignSpec` |
| `plan` | Versioned per campaign. Motions, capabilities, bindings, cost estimate, policies |
| `motion_allocation` | `motion_id, operating_budget, commit_budget, dependsOn[]` |
| `run` | `kind: discovery \| outreach \| follow_up \| re_engagement \| replan` |
| `target` | **`kind: organization \| person \| segment`** + typed payload + `relationship` |
| **`edge`** | **`from_target, to_target, kind, evidence_id, confidence`** |
| `contact` | Person, channel handles, confidence, source |
| **`signal`** | Proof Graph. **`evidence_kind: documentary \| statistical`** (see below) |
| `assessment` | `decision, score, rubric_json, evidence_ids[]` |
| `allocation` | Creator roster selection: chosen set, price, overlap penalty, rationale |
| `message` | Draft, channel, body, `evidence_ids[]` per sentence, approval status |
| `interaction` | sent / delivered / opened / replied, with parsed intent |
| `tool_call` | Ledger: name, args hash, result, `cost_usd`, latency, mode |
| `policy` / `approval` / `suppression` | Governance |

### Three target kinds cover every motion

```
organization → business.local, business.online
person       → creator (relationship: prospect_partner)
               consumer.email (relationship: customer)
segment      → consumer.ads
```

`relationship` matters because creators and customers are both `person` with opposite
consent rules.

### `signal.evidence_kind` is per-signal, not per-motion

Creator Motion proves this: its rate card and past collabs are documentary, its audience
overlap and authenticity scores are statistical. Same table, discriminated payload.

| kind | payload |
|---|---|
| `documentary` | `source_url, excerpt, start_char, end_char, implication, strength` |
| `statistical` | `metric, value, baseline, method, window, implication, strength` |

Documentary signals come from Claude citations, so `excerpt` is byte-exact by construction.

### `edge` is what makes it a graph

Without edges this is three flat tables, not an entity graph. Edge kinds:

```
mentions · employed_by · competitor_of · same_owner
audience_overlap · customer_of · partnered_with
```

The demo discovers `mentions` edges deterministically (fuzzy-match creator post captions
against business names in the target set) — no model needed, and it surfaces as a
**"warm intro path"** badge on the grid. That single badge is the proof that the graph is
shared rather than three apps in a trench coat.

---

## Motion registry

A motion is a **declaration**, not a code path. Adding motion #4 is a registry entry plus
adapters — no new pipeline.

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

| Motion | Target | Discovery | Evidence | Allocation | Terminal state |
|---|---|---|---|---|---|
| `creator` | person | `db.query` creator index | mixed | **yes** | content_published |
| `business.local` | organization | `geo.query` | documentary | no | meeting_booked |
| `business.online` | organization | `db.query` company index | documentary | no | meeting_booked |
| `consumer.ads` | segment | `segment.build` first-party | statistical | budget split | campaign_live |
| `consumer.email` | person | trigger on customer base | statistical | no | conversion |

Creator and business.online share one discovery *pattern* (`db.query` over a typed index);
only the schema and filters differ. Local geo-query is the only genuinely distinct one.

Two fields force real branching in the engine: `allocation` (portfolio selection under
budget) and `contactModel: 'none'` (segment motions skip contact discovery and per-message
approval entirely). Everything else is data.

---

## Capability registry + adapters

A capability is a Zod contract, not a vendor. Adapters declare which capabilities they
provide, at what unit cost, in which mode.

| Capability | Demo adapter | Mode | Production path |
|---|---|---|---|
| `geo.query` | `sim/market` | sim | Outscraper, Google Places |
| `db.query` | `sim/index` | sim | Apollo, Modash, Clay |
| `web.fetch` | `sim/market` | sim | Firecrawl |
| `reviews.fetch` | `sim/market` | sim | Outscraper reviews, Yelp |
| `people.find` | `sim/market` | sim | Apollo, Hunter |
| `segment.build` | `sim/cohort` | sim | first-party warehouse |
| `message.send:whatsapp` | `twilio` | **live** | unchanged |
| `message.send:email` | `resend` | **live** | unchanged |
| `ads.plan` | `sim/estimator` | plan-only | Google Ads API |

**This table is the go-to-prod answer.** Swap the adapter; the contract and the agent are
untouched. Say it in the pitch.

### The synthetic market

Generated **once at build time**, committed as JSON — so the demo is instant, deterministic,
and survives dead hackathon wifi.

- **Businesses**: name, category, geo, rating, review count, 6–10 reviews mixing praise with
  specific operational complaints, a website HTML snapshot, 1–3 contacts.
- **Websites** are templated across quality tiers with defects genuinely present in the
  markup: missing `<meta viewport>`, `© 2019`, no booking link, inline-styled 2000px hero,
  phone number only inside an image.
- **Creators**: handle, platform, followers, engagement rate, view-to-follower ratio,
  audience geo/age/interest split, fake-follower estimate, content categories, brand-safety
  flags, past collabs, **rate card by format**, reachability. Seed 2–3 of them with posts
  mentioning businesses in the target set so the `mentions` edge is real.

**Hard rule: the generator emits artifacts, never signals.** No `signal` row is ever written
by the seeder. The agent reads the snapshot and the reviews and derives the finding itself,
with a citation. Break this rule and the demo is a puppet show.

---

## Pipeline

### Stage 0 — Objective → CampaignSpec

One Opus 5 call, strict tool use, streamed. Creates the `campaign` row in `draft`
immediately, so the work is persisted and shareable before approval.

```
"We're launching a new hydrafacial device. Get us in front of med spas in
 Phoenix, and line up local beauty creators to promote it.
 $5,000 for partnerships, keep operating spend under $5."
       ↓
CampaignSpec { motions[], icp, geo, volume, channels, budget{operating, commit},
               success_metric }
```

Renders as an **editable form** before planning — the compiler framing, and a recovery path
if the parse is odd on stage.

### Stage 1 — CampaignSpec → Plan

One Opus 5 call, fast mode, task budget attached. The model selects from the registry; it
does not invent capabilities.

```
Plan {
  motions: [
    { id: business.local, targets: 60, operating: $2.10, commit: $0 },
    { id: creator,        targets: 24, operating: $0.80, commit: $3,500 },
    { id: consumer.ads,   targets: 1,  operating: $0.30, commit: $1,500 },
  ],
  bindings: [...], policies: [...],
  total: { operating: $3.20, commit: $5,000 }
}
```

→ **HUMAN GATE.** Budget split is editable here. Nothing external has been touched.

### Stage 2 — Fan-out

Orchestrator spawns one **motion agent** per motion, running in parallel, each with its own
SSE channel, drawing from its own budget slice, writing to the shared graph. Failure is
isolated per motion.

**Agent boundary rule:** agents where reasoning is open-ended (motion planning, roster
allocation, synthesis, re-planning). Pipelines where work is fixed. Sixty targets is *not*
sixty agents — it's one motion agent driving a bounded-concurrency pipeline. Total: 3–5
agents per campaign, not 3 + N.

### Stage 3 — Per-target pipeline (concurrency 8)

| # | Step | Who | Notes |
|---|---|---|---|
| 1 | discovery | code | One call per motion, not per target |
| 2 | observation | code | Snapshot + reviews from fixtures. No model |
| 3 | **evidence extraction** | Sonnet 5 | Documents with `citations: enabled` → persist citation objects as `signal` |
| 4 | **assessment** | Sonnet 5 | Input is **only signals**, never raw pages. Strict tool use |
| 5 | contact discovery | code | Only if `decision === fit` — gates spend on unqualified leads |
| 6 | **draft** | Sonnet 5 | Per-sentence `evidence_id` tagging |
| 7 | policy eval | code | Deterministic. Returns `require_approval` |

Three model calls per target. Steps 3 and 4 are split because citations conflict with
`output_config.format` — but it's better design regardless: **assessment reasons over
evidence, never over raw pages**, so it cannot smuggle in an uncited claim.

### Stage 3b — Allocation (creator only)

Campaign-level, after scoring. Select a roster under `commit_budget`, penalizing
`audience_overlap` edges so we don't double-pay for the same eyeballs. Writes `allocation`
with rationale. This is a **second human gate** — approve the roster and spend split, not
just individual messages.

### Stage 4 — Synthesis

Cross-motion dedup, edge discovery (`mentions` matching), rollup. Surfaces warm intro paths
back onto business targets.

### Stage 5 — Approve → send → reply

```
approve → policy re-eval → message.send (LIVE) → interaction: sent
                                    ↓
                     inbound webhook (Twilio / Resend)
                                    ↓
             Haiku 4.5 → {intent, sentiment, next_action}
                                    ↓
             interaction: replied → SSE → grid: engaged
```

### Target state machine

```
discovered → observed → scored ─┬→ not_fit          (terminal, stays visible)
                                └→ fit → contact_found → draft_ready
                                          → pending_approval → sent
                                          → delivered → engaged | suppressed
```

`not_fit` rows staying on the grid matters — an agent visibly *rejecting* leads with reasons
is more credible than sixty green rows.

---

## Surfaces

| Screen | Contents | Priority |
|---|---|---|
| **Campaign list** | name, motions, status, spend (operating + commit), replies | P1 — 20 min, makes it read as a product not a script |
| **New campaign** | one-box objective → streamed spec → editable form | P0 |
| **Plan** | motion cards, capability bindings, cost breakdown, policy list, editable budget split, **Approve** | P0 |
| **The Grid** | hero. rows streaming through states, motion column + filter chips, live cost ticker, "saved by caching" counter, warm-intro badge | P0 |
| **Evidence drawer** | Proof Graph per target; click a signal → highlights the exact character span in the source document | P0 |
| **Roster** | creator allocation: chosen set, price, overlap penalty, rationale, approve | P1 |
| **Approval queue** | draft with sentences linked to evidence; approve / edit / reject | P0 |
| **Ledger** | every tool call, cost, latency, mode; replay button | P2 |

---

## Policy engine

Deterministic, evaluated before **every** external side effect. Returns
`allow | deny | require_approval` with a reason that renders in the UI.

| Policy | Applies to |
|---|---|
| `operating_budget_cap` | warn 80%, hard-pause 100% |
| **`external_spend_commit`** | `max_per_deal`, `max_total`, `requires_role` — creator fees and ad spend |
| `require_approval(send)` | every outbound message |
| `require_approval(roster)` | creator allocation |
| `consent_policy` | per-motion: `legitimate_interest` vs `explicit_opt_in` |
| `suppression_check` | campaign + workspace scope |
| `rate_limit` | per channel, per run |

Qualification is a model call; **policy, budget, suppression and consent are pure code.**
When a judge asks what stops it emailing someone who opted out, the answer is "a
deterministic check, not a prompt." That's the plan-and-execute claim.

---

## Cost model — two budgets, never summed

Mixing inference cost with creator fees in one number is misleading. Track both.

- **`operating`** — inference, data, delivery. Cents to a few dollars.
- **`commit`** — external money committed to third parties. Hundreds to thousands.

| Model | Role | Input $/MTok | Output $/MTok |
|---|---|---|---|
| `claude-opus-5` | orchestrator, planning, synthesis | $5.00 | $25.00 |
| `claude-sonnet-5` | motion agents, evidence, allocation, drafting | $3.00 (**$2.00 intro thru 2026-08-31**) | $15.00 (**$10.00 intro**) |
| `claude-haiku-4-5` | reply classification, tagging | $1.00 | $5.00 |

Sim adapters carry **shadow costs** matching real vendor rates (`geo.query` @ $0.003/record,
matching Outscraper's $3/1k) so the plan estimate is what production would actually cost.
Label these as projected in the UI — do not pass shadow spend off as real spend.

**Demo scale: 60 business targets, 24 creators, $5 operating cap.** At ~$0.035/target the
B2B leg lands near $2.10, so the ticker visibly climbs and the cap is meaningful. Twenty
targets against a $40 cap would make the ticker decorative.

---

## Advanced Claude capabilities

Each is here because it solves a problem MotionGrid actually has. Ordered by
impact-per-hour; build down and stop when time runs out.

### Tier A — in the build

**1. Citations → the Proof Graph, enforced by the API.** Website snapshot and reviews as
`document` blocks with `citations: {enabled: true}`. Response carries `cited_text` plus exact
`start_char_index` / `end_char_index`. Our central promise — every claim traces to a verbatim
source — becomes **mechanically guaranteed rather than prompt-requested.** The citation
object *is* the `signal` row.

> Constraint: citations 400 alongside `output_config.format`, hence the 3/4 split. Verify on
> hour one whether `strict: true` tool use is also affected.

**2. Task budgets** (`output_config.task_budget`, beta `task-budgets-2026-03-13`). Makes the
agent *aware* of the campaign budget so it paces itself instead of being cut off mid-target.
Minimum 20k tokens, requires streaming. Pitch line: *"the budget isn't just enforced on the
agent — the agent knows about it and plans around it."*

**3. Prompt caching, with the savings on screen.** Workspace profile + ICP + rubric are
identical across all 60 targets. Opus 5's minimum cacheable prefix is **512 tokens**, so even
a modest rubric caches. Surface `cache_read_input_tokens` as a live "saved by caching"
figure. A real number beats a claim.

**4. Advisor tool** (`advisor_20260301`). Sonnet 5 motion agents consult an Opus 5 advisor
mid-turn on genuinely hard qualification calls — server-side, no loop to write. Opus 5 is a
*redacted* advisor: render it honestly as "escalated to orchestrator," don't fake advice text.

**5. Programmatic tool calling.** One sandboxed script loops over targets calling our
capability tools and returns only the ranked shortlist — intermediate page content never
enters the context window. Capture the before/after token count as a slide.

**6. Tool search + `defer_loading`.** The registry is designed to grow to dozens of adapters.
Mark adapter tools deferred; keep the search tool and one capability non-deferred (all-deferred
is a 400).

**7. Mid-conversation tool changes** (beta `mid-conversation-tool-changes-2026-07-01`).
Runtime adapter binding is the core architectural claim; this adds and removes bound
capabilities mid-conversation **without invalidating the cache.** Composes with #6 for free.

**8. Fast mode** (`speed: "fast"`, Opus 5, $10/$50). Plan compilation is the one moment the
room watches a model think. Buy 2.5× output speed for those 30 seconds; leave motion agents
standard. On 429, drop `speed` and continue.

### Tier B — one showcase if Tier A lands by Day 2 midday

**Agent Skills closer** — `container.skills` with `pptx` + `code_execution_20260521`. After
the reply lands: *"and here's the campaign brief it wrote for your board."* ~20 lines,
downloads via the Files API. Best effort-to-impact ratio in the whole list; promote it into
Tier A if rehearsal shows a weak ending.

**Managed Agents multiagent session.** `multiagent: {type: "coordinator", agents: [...]}` is
an almost literal encoding of our architecture. But CMA owns the event stream, which
competes with the custom SSE grid that is the hero screen. Stand it up as a *separate narrow
tab*, never a Day-2 refactor of the main pipeline. The architecture already maps 1:1, so
"we'd port to Managed Agents" is a credible roadmap slide either way.

### Tier C — roadmap slide, not build

**Memory Stores** (workspace memory across campaigns, versioned, auditable, redactable —
exactly the product spec's "structured memory") · **Vaults with `environment_variable`
credentials** (customer Twilio/Gmail/Ads secrets substituted at egress, never visible in the
sandbox — the answer to "how do you hold our credentials?") · **Scheduled deployments**
(campaign as cron) · **Batch API** (50% off overnight scoring) · **Context editing +
compaction** · **Webhooks**.

---

## Tech stack

Bun + TypeScript (strict) · Hono (API + SSE + inbound webhooks) · Vite + React + Tailwind ·
SQLite via `bun:sqlite` + Drizzle · Zod on every capability contract · `@anthropic-ai/sdk`.

Single Bun process serves API and built SPA — one command, one port, nothing to orchestrate
on stage.

---

## Build plan

Blocks 1–5 are the demo. Block 6 is upside. If behind at end of Day 1, cut Creator
allocation before cutting anything in 1–5.

### Day 1 AM — spine
- `bun init`, Hono + Vite + Tailwind, one-command dev script
- Drizzle schema + migration for every table, including `campaign`, `edge`, `motion_allocation`
- Capability registry with Zod contracts; adapter interface + registration
- Motion registry with `defineMotion` for all five motions
- `sim/generate.ts` — one-time fixture generator (Faker + one LLM pass for reviews and
  creator bios), committed to `sim/fixtures/*.json`. Seed the creator↔business mentions

### Day 1 PM — the agent
- Objective Compiler → `CampaignSpec`, campaign row created in `draft`
- Orchestrator → `Plan` with capability resolution, binding, dual-budget estimate, policies.
  **Fast mode** (A8) + **task budget** (A2) here
- Run engine: motion fan-out, per-target pipeline, bounded concurrency, SSE event bus
- **Evidence extraction via citations (A1)** — do this before writing any "quote verbatim"
  prompt; the API makes that instruction unnecessary
- Assessment as a separate strict-tool-use call over signals only
- **Prompt caching (A3)** — verify `cache_read_input_tokens > 0` on target #2 before moving on
- Cost ledger + policy engine wired into every adapter call

### Day 2 AM — the show
- Plan screen: streaming plan, motion cards, dual-budget breakdown, editable split, Approve
- **The Grid**: streaming rows, motion column, live ticker, caching counter
- Evidence drawer with character-span highlighting over the source document
- Approval queue with evidence-linked sentences

### Day 2 PM — real outbound, cross-motion, the close
- Twilio WhatsApp (sandbox) + Resend email behind `message.send`
- Inbound webhook → Haiku 4.5 classifier → `interaction` → live grid update
- Synthesizer: `mentions` edge discovery → warm-intro badge on the grid
- Creator roster screen (allocation + approve); consumer ad plan card
- Campaign list screen
- **Rehearse three times. Then once with wifi off.**

### Block 6 — upside, in priority order
1. Creator index fixture depth + allocation quality (highest value/hour)
2. Agent Skills closer (Tier B)
3. Advisor tool (A4)
4. Programmatic tool calling (A5)
5. Tool search + mid-conversation tool changes (A6 → A7, paired)
6. Replay button — deterministic re-run from the `tool_call` ledger in ~30s. Doubles as a
   safe second demo run *and* it is the audit story
7. Follow-up wave (`run.kind: follow_up`) — proves the campaign has state
8. CMA multiagent tab (Tier B)

---

## Demo script (4 minutes)

1. **0:00** — "GTM tools got better at writing emails and reply rates fell below 1%. The
   problem isn't the writing — it's that there's no reason to reply." *(15s)*
2. **0:15** — Type the objective. Plan streams: **three motions**, budget split into
   operating vs commit, policy list, approval gate. "It told us what it would cost, in two
   currencies, before touching anything." *(45s)*
3. **1:00** — Approve. The Grid fills with mixed-motion rows. Ticker climbs. Talk over it. *(40s)*
4. **1:40** — Evidence drawer on the best lead. Read the review quote, click it, the exact
   span highlights in the source. "Not a personalization token — a cited reason to talk. And
   the citation is enforced by the API, not asked for in a prompt. The model *can't* invent
   this quote." *(45s)*
5. **2:25** — Point at the warm-intro badge. "A creator this campaign found has already
   posted about this business. Two motions, one graph. Three separate tools can't do that." *(25s)*
6. **2:50** — Approval queue → sentence highlighted to its evidence → approve.
   **"Check your phone."** *(35s)*
7. **3:25** — Judge replies. Grid flips to `engaged` live. *(20s)*
8. **3:45** — "Market data is simulated. The reasoning, the policies, the citations, the
   messages and that WhatsApp are real. Swapping the sim adapter for Outscraper is one line —
   the agent doesn't change." *(15s)*

---

## Risks — start these in hour one

| Risk | Mitigation |
|---|---|
| WhatsApp needs a public webhook URL | `cloudflared tunnel` in hour one, not hour twenty |
| Twilio sandbox requires each recipient to text a join phrase | Pre-join the demo phone the night before; QR on a backup slide |
| WhatsApp business approval is multi-day | Use the **Twilio sandbox**, not Meta Cloud API. **Telegram bot is the 10-minute fallback** |
| Resend on a bare domain only sends to your own address | That's exactly the demo case. Don't attempt domain verification |
| Google Ads needs an approved developer token | Out of scope for execution. `consumer.ads` *plans* only; say so plainly |
| Betas are gated per-account | Smoke-test each header hour one with a one-line curl: task budgets, advisor, fast mode, mid-conv tool changes. **No beta may be load-bearing** |
| Fast mode has its own rate limit | On 429, drop `speed` and retry standard |
| Hackathon wifi | Fixtures are local; only Anthropic + Twilio/Resend need network. Record a full successful run as the ultimate fallback |

---

## Verification

- `bun test` — capability contract round-trips (Zod parse of every adapter I/O), motion
  registry validation, policy decision table, cost ledger arithmetic (both currencies).
- **Citation integrity**: for every documentary `signal`,
  `source.slice(start_char, end_char) === excerpt`. This is the test that proves the Proof
  Graph. If it fails, the evidence story is decoration.
- **Caching**: `cache_read_input_tokens > 0` from target #2 onward.
- **Offline run**: network disabled to sim adapters; a full 60-target campaign reaches
  `draft_ready` with zero errors.
- **Determinism**: same objective, same seed, twice — identical target set and identical
  citation offsets. Divergence means the sim is leaking randomness and the second demo run
  will embarrass you.
- **Budget enforcement**: operating cap $0.50 → run pauses and surfaces the policy reason.
  `external_spend_commit` with `max_per_deal` below a creator's rate → that creator is
  excluded from the roster with a stated reason.
- **Beta degradation**: full campaign with every beta header removed. Must complete —
  slower and dumber, but green.
- **Live send**: one WhatsApp and one email land; the reply webhook writes an `interaction`
  and the grid changes without a refresh.

---

## Future scope

**Near** — real discovery adapters (Outscraper, Apollo, Modash, Firecrawl); CRM write-back;
deliverability and warmup; multi-workspace tenancy and auth; `business.online` execution.

**Mid** — Creator Motion past outreach: brief → contract → promo code issuance → content
approval → attribution → payment (needs a `collaboration` entity B2B doesn't have).
Consumer Motion execution against Meta/Google. Dynamic budget rebalancing across motions
based on live conversion. Motion DAG execution (`dependsOn`) so creator content is live
before ads amplify it.

**Long** — outcome learning. `interaction` feeds back into scoring so the orchestrator plans
from what actually converted rather than a static rubric, and edges accumulate into a
proprietary graph that gets better with every campaign. That is the compounding moat, and
it is the reason the shared entity graph and the campaign root exist from day one rather
than being retrofitted.
