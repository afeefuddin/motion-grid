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

- [x] Five motions registered; a registry test asserts every declared capability exists
- [x] Each agent callable standalone with a fixture input, returning schema-valid output
- [x] Every capability exposed as a Mastra tool
- [x] Model IDs match T0's verified findings
- [x] `grep -rn " as \| any" src/motions src/mastra/agents src/mastra/tools` returns nothing
- [x] Handoff note written

---

## Handoff note

Completed 2026-08-08.

- `motionRegistry` contains all five frozen motion IDs. Motion definitions carry discovery,
  observation, contact, ordered channels, allocation, terminal state, consent, and weighted
  rubric data. `consumer.email` records its customer-base trigger without inventing a
  capability. `business.local` is WhatsApp-first and its six criteria cover the observable
  website and review defects in this brief.
- Stable Mastra agent IDs are `objective-compiler`, `planner`, `evidence-extractor`,
  `assessor`, `drafter`, and `reply-classifier`. T6 should call the exported `run*` functions;
  they parse the frozen step input, invoke structured output, and return the matching
  `{ ok: true, data }` step contract. The assessor is intentional: the main plan requires
  model-based assessment over signals only, but the original five-agent table omitted the
  agent needed for that step.
- Model routing is Opus 4.7 for objective compilation and planning, Sonnet 4.6 for evidence,
  assessment, and drafting, and Haiku 4.5 for reply classification. The first two match T0's
  verified handoff; the installed Mastra 1.57.0 provider registry also contains the Haiku
  route used for the low-cost tier.
- Evidence extraction explicitly requires verbatim excerpts and leaves `verified: false` for
  T6's deterministic string check. Assessment instructions prohibit raw documents. Drafting
  requires one supplied evidence ID per sentence and uses a null subject for WhatsApp.
- Capability tools use provider-safe tool IDs (`geo-query`, `db-query`, and so on) while
  preserving the frozen capability IDs in the registry and ledger. Each capability has an
  individual factory, so a workflow configures only its persisted binding. The all-tools
  factory is a convenience. Every execution delegates to T3's `executeCapability` with the
  bound adapter, run context, and ledger writer; no tool calls an adapter directly.
- T2's current sim objects still use its earlier `{ adapterId, capability, execute(input) }`
  shape instead of T3's final `Adapter` interface (`id`, `provides`, `mode`, and
  `execute(capabilityId, input)`). T4 deliberately does not hide that cross-task mismatch.
  T6 needs T2's adapters updated or normalized at its composition boundary before passing
  them to these tool factories.
- Verification passed: `pnpm typecheck`, production `pnpm build`, Biome over all T4 paths,
  the zero-cast grep, contract smoke parsing (167 schemas), sim adapter tests, and 9 focused
  T4 tests. The broader policy/ledger/capability tests passed; the repository test process
  could not start because this shell has no `DATABASE_URL`.
- The shell also has no `ANTHROPIC_API_KEY`, so no paid live model request was made. Focused
  tests inject schema-valid fixture agents through the same standalone runners and verify
  their complete input/output boundaries; live provider validation remains an environment
  check for T10 when credentials are present.
