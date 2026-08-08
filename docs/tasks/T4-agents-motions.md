# T4 · Mastra Agents, Tools & Motion Registry

**Wave 1 · parallel with T1, T2, T3, T5 · ~4h · depends on T0**

The reasoning layer. Five motion declarations, five Mastra agents, and the capability tools
agents call. T6 wires these into workflows — you make each one independently callable and
correct.

## Owned paths (exclusive write)

```
src/motions/**
src/mastra/agents/**
src/mastra/tools/**
```

## Read-only

`src/contracts/**` — **frozen**. `src/mastra/index.ts` belongs to T0/T6; register your agents
by exporting them, don't edit that file.

## Forbidden

`src/mastra/workflows/**` (T6), `src/capabilities/**` (T3), `src/adapters/**` (T2/T7).

## Deliverables

### 1. `src/motions/**` — five declarations

A motion is **data, not a code path**. Adding a sixth must be a registry entry, not a new
pipeline.

```ts
defineMotion('business.local', {
  targetKind:    'organization',
  discovery:     ['geo.query'],
  observation:   ['web.fetch', 'reviews.fetch'],
  rubric:        localB2BRubric,
  contactModel:  'individual',
  channels:      ['whatsapp', 'email'],
  allocation:    false,
  terminalState: 'meeting_booked',
  consentPolicy: 'legitimate_interest',
})
```

| Motion | Target | Discovery | Allocation | Demo depth |
|---|---|---|---|---|
| `creator` | person | `db.query` | **yes** | plan + roster |
| `business.local` | organization | `geo.query` | no | **full execution** |
| `business.online` | organization | `db.query` | no | registered, not run |
| `consumer.ads` | segment | `segment.build` | budget split | plan only |
| `consumer.email` | person | trigger | no | registered, not run |

Only two fields force branching downstream: `allocation` and `contactModel: 'none'`.

**Channel ordering matters here.** We're operating in India — WhatsApp is the primary business
channel for local SMBs, email is secondary. `business.local.channels` is `['whatsapp',
'email']` in that order, and the drafting agent should treat WhatsApp as the primary medium
(short, direct, no subject line) rather than writing an email and truncating it.

### 2. Rubrics

Per-motion qualification rubric as **data**, not prose buried in a prompt. The local-B2B
rubric scores against observable defects: no online booking, stale site, no mobile viewport,
unanswered-call complaints in reviews, rating trend, bookings happening in Instagram DMs.

### 3. `src/mastra/agents/**` — five agents

| Agent | Job | Structured output |
|---|---|---|
| `objectiveCompiler` | NL → `CampaignSpec` | yes |
| `planner` | `CampaignSpec` → `Plan` (selects from the capability registry, never invents) | yes |
| `evidenceExtractor` | documents → `Signal[]` | yes |
| `drafter` | signals + contact + workspace → message per channel, **per-sentence `evidence_id`** | yes |
| `replyClassifier` | inbound text → `{ intent, sentiment, next_action }` | yes |

Use Mastra's `structuredOutput: { schema }` with the Zod schemas from
`contracts/steps.ts`. Do not hand-parse model output.

Model tiering: heavier model for `objectiveCompiler` and `planner`, mid for
`evidenceExtractor` and `drafter`, cheapest for `replyClassifier`. **T0's handoff note tells
you which Anthropic model IDs Mastra's router actually resolves** — read it before hardcoding
strings.

### 4. `src/mastra/tools/**`

Wrap each capability from T3's registry as a Mastra `createTool`, using the schemas in
`contracts/capabilities.ts`. The tool calls the registry; it does not call an adapter
directly. If T3 isn't finished, code against the contract and the interface in their brief.

## Prompting notes

- The `evidenceExtractor` must return an `excerpt` copied **verbatim** from the source.
  T6 verifies this with a string match and **drops** anything that fails, so paraphrase costs
  us signals. Say so plainly in the instructions.
- The `assess` reasoning consumes **only signals**, never raw pages — that firewall is
  enforced by T6's step wiring, but write the instructions assuming it.
- Keep instructions declarative. State the goal, the evidence minimum (**≥3 signals from ≥2
  distinct sources**), and the output contract. Do not write step-by-step scripts.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. Parse at the edge — **LLM structured output is a parse boundary**; the schema handles it.
3. **Zero `as`. Zero `any`.**
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **None are in this task.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining.
7. Adapters are pure w.r.t. their contract.

## Done when

- [ ] Five motions registered; a registry test asserts every declared capability exists
- [ ] Each agent callable standalone with a fixture input, returning schema-valid output
- [ ] Every capability exposed as a Mastra tool
- [ ] Model IDs match T0's verified findings
- [ ] `grep -rn " as \| any" src/motions src/mastra/agents src/mastra/tools` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially agent names/IDs T6 needs, and any prompt behaviour worth knowing)_
