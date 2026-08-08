# T11 · Autonomous orchestration — one prompt, every motion

**Wave 4 · ~4h · single owner · backend only · T9 UI has landed**

The UI already asks for exactly one thing: a plain-language objective
(`apps/web/components/campaign-create-form.tsx`). The backend does not yet accept that. Three
gaps stand between the current build and the product promise in `docs/PRODUCT.md`:

1. **Autonomy is faked client-side.** The create form hardcodes `workspaceId`, derives the
   campaign name with a `slice(0, 53)`, and ships two hardcoded budget constants
   (`campaign-create-form.tsx:11,44-49`). The objective compiler already infers motions,
   geography, criteria and channels from the prompt — the API just never lets it.
2. **`business.online` is unreachable.** It is declined by a hardcoded `switch` in
   `src/orchestrator/plan.ts:103`, has no workflow, and the target pipeline it would need is
   welded to `business.local`.
3. **Discovery ignores geography.** `discoverBusinessLocal` hardcodes Bengaluru's coordinates
   (`src/mastra/workflows/business-local.ts:386`). An objective naming Pune still searches
   Bengaluru.

This task closes all three, plus two adjacent defects it would be dishonest to leave (§7, §8).

**Scope boundary:** backend only. Do not edit `apps/web/app/**` or `apps/web/components/**`.
The UI changes this unblocks are listed at the end for the UI owner; they are not yours.

## Owned paths (exclusive write)

```
src/contracts/**                        the second owned unfreeze — see Coordination
src/db/schema.ts + one migration        you are the migration owner for this change only
src/motions/**
src/orchestrator/plan.ts
src/orchestrator/adapters.ts
src/mastra/workflows/**
src/mastra/agents/objective-compiler.ts
src/adapters/sim/market-geo.ts          locality filter only
src/adapters/generated/adapters.ts      locality cache key only
apps/web/lib/campaigns.ts               request shape + compiled-spec write-back
apps/web/lib/workflows.ts               removing the dead resume path
```

## Read-only

Everything else. In particular `src/evidence/**`, `src/policy/**`, `src/ledger/**`,
`src/capabilities/**`, and `src/db/repositories/**` are correct as they stand and this task
does not touch them.

## Coordination

- **This is the second owned contract unfreeze**, after C2. Every change in §1 is additive or
  makes a required field optional; nothing already persisted becomes invalid. Contracts freeze
  again when this lands.
- **One migration**, covering both new columns in §1. Generate it with `drizzle-kit generate`
  and apply with `db:push`, exactly as T0 and C2 did.
- Land §1 → §2 → §3 → §4 together; they are interdependent. §5 through §8 are independent of
  each other and can land in any order after §4.

---

## 1. Contract and schema amendment

### Schema (one migration)

| Table | Column | Type | Why |
|---|---|---|---|
| `target` | `motion_id` | `motionIdEnum`, not null, default `'business.local'` | Two motions now produce `organization` targets. Without this the Grid cannot tell a local business from an online one, and neither can synthesis. `motionIdEnum` already exists at `src/db/schema.ts:54`. |
| `workspace` | `connected_sources` | `jsonb`, not null, default `'[]'` | Which first-party data sources this workspace has connected. Drives §2's decline reasons with a fact instead of a hardcoded string. |

`connected_sources` is a `WorkspaceSourceSchema[]`; define that enum in `contracts/enums.ts`
with the single member `first_party_customers`. Seed it empty — `scripts/seed.ts` is read-only
to you, so if the seed needs a value, raise it rather than editing it.

Regenerate the `drizzle-zod` entity schemas so `TargetSchema` and `WorkspaceSchema` carry the
new fields. Do not hand-write them.

### Contracts

```
contracts/enums.ts
  + WorkspaceSourceSchema           z.enum(["first_party_customers"])

contracts/capabilities.ts
  ~ GeoQueryInputSchema             + locality: z.string().min(1).optional()
                                    latitude/longitude/radiusKm stay required —
                                    real providers need them; see §4

contracts/api.ts
  ~ CreateCampaignRequestSchema     name and budget become .optional()
                                    workspaceId stays required
  + AssessmentRecordedEventSchema   type: "assessment.recorded"
                                    data: { targetId, score, isFit, reason, droppedCount }
  ~ SseEventSchema                  add the new member to the union

contracts/steps.ts
  ~ CompileObjectiveInputSchema     budget becomes .optional()
  ~ CampaignSpecSchema              budget gains min/max bounds — see §5
```

`CampaignSpecSchema` **already declares `name`** (`contracts/steps.ts:50`). The compiler
already returns it. Nothing new is needed there; §5 just starts using it.

### Motion definition

`MotionDefinition` (`src/motions/types.ts:28`) gains one field:

```ts
readonly requiresWorkspaceSource: WorkspaceSource | null;
```

Set it in `src/motions/registry.ts`:

| Motion | Value |
|---|---|
| `creator`, `business.local`, `business.online` | `null` |
| `consumer.ads`, `consumer.email` | `"first_party_customers"` |

---

## 2. Derive the motion decline — this is what unlocks `business.online`

Delete `declineReason()` (`src/orchestrator/plan.ts:103`). A motion is declined when **either**
condition holds, and the reason states which:

1. **A required capability has no eligible adapter.** Run the existing `rankAdapters` over the
   motion's `discovery` and `observation` capabilities. If any produces zero eligible
   candidates, decline with the ranking's own reason — it already explains coverage and
   throughput failures in prose.
2. **`requiresWorkspaceSource` is set and the workspace has not connected it.** Decline with
   e.g. `"no first-party customer data source is connected; segment.build has no warehouse to
   build from"`.

`planCampaign` will need the workspace's `connectedSources` passed through
`PlanInputSchema`. Add it as a required field on the plan input — `apps/web/lib/campaigns.ts`
already reads the workspace row.

### Why the second condition exists

Deriving decline purely from capability availability looks cleaner and is wrong.
`cohortSegmentSimAdapter` provides `segment.build`, so a purely capability-derived rule would
make `consumer.ads` *eligible* and silently delete the demo's most defensible beat — an
orchestrator refusing work it cannot justify. The adapter simulates first-party data that this
workspace does not have. `requiresWorkspaceSource` encodes that distinction as a fact about the
workspace rather than a `case` label, which is the whole point.

**After this section `business.online` is selectable with no special-casing anywhere.**

---

## 3. One generic organization pipeline

Rename `src/mastra/workflows/business-local.ts` → `organization.ts` and generalise
`processBusinessLocalTarget` to `processOrganizationTarget(motionId, input, runtime)`. Four
hardcodes come out:

| Line | Hardcode | Replacement |
|---|---|---|
| `:172-194` | `reviews.fetch` called unconditionally | Loop over `getMotion(motionId).observation`; build the `documents` array from whatever that motion declares |
| `:111`, `:229` | `assessmentRubric(getMotion("business.local"))` | `getMotion(motionId)` |
| `:251` | `getMotion("business.local").channels` | `getMotion(motionId).channels` |
| `:309-323` | `motionId: "business.local"` and its literal `consentBasis` | Both from `getMotion(motionId)` |

Discovery becomes motion-driven too:

| Motion | Discovery | Observation |
|---|---|---|
| `business.local` | `geo.query` | `web.fetch`, `reviews.fetch` |
| `business.online` | `db.query` (`entityKind: "company"`, `filters.category` and `filters.locality` from the spec) | `web.fetch` |

Persist `motionId` on every target written by `saveTargets`.

In `composition.ts`, replace `createBusinessLocalWorkflow` with
`createOrganizationWorkflow(motionId, runtimeFor)` and build the `.parallel([...])` fan-out from
the motions the plan actually selected — not the current hardcoded
`[businessLocalWorkflow, creatorStep]` (`composition.ts:362`).

**The evidence pipeline does not change.** Extract → deterministic verification → assess over
signals only → `droppedCount` already works and is already motion-agnostic. Both organization
motions run through it unmodified. That is the point of generalising rather than forking:
online discovery gets evidence-backed qualification for free.

---

## 4. Geography reaches discovery

Remove the hardcoded `latitude: 12.9716, longitude: 77.5946, radiusKm: 30` from the `geo.query`
call (`business-local.ts:386`).

Pass `spec.geography` as the new optional `locality`. `marketGeoSimAdapter` filters its fixture
on it; the generated adapter folds it into its cache key so `("Pune", "dental clinic")` is a
distinct cached world. Keep coordinates in the input contract — they are what a real Outscraper
or Places adapter binds to, and dropping them would make the contract worse to serve one
simulator.

Verification for this section: an objective naming a city outside the fixture must produce
targets in that city, not Bengaluru.

---

## 5. One-prompt campaign creation

`POST /api/campaigns` accepts `{ workspaceId, objective }`. `name` and `budget` stay accepted
when supplied and are inferred when not.

Wiring, in `apps/web/lib/campaigns.ts` and `composition.ts`:

1. `createCampaign` inserts the campaign row with the caller's values when present, otherwise
   provisional ones, and starts the workflow with `budget` omitted.
2. `compile-objective-step` compiles the spec — the compiler already returns `name` and
   `budget`.
3. A new service method `recordCompiledSpec({ campaignId, name, budget })` writes them back to
   the campaign row **before** `plan-step` runs, so the plan and the ledger read one budget.

Do not compile twice to avoid the write-back. One compile, one authoritative spec.

### Compiler changes

`objectiveCompiler` instructions gain: when a budget is supplied, preserve it exactly; when it
is not, infer both from the objective's scale, geography and motions.

Bound it in the schema, not the prompt — add min/max to `CampaignSpecSchema.budget` so an
inferred budget cannot exceed a sane ceiling. Suggested: operating `$1–$100`
(`100`–`10_000` cents), commit `₹0–₹5,00,000` (`0`–`5_00_00_000` paise). A model that returns
something outside that is rejected at the parse boundary, not clamped — same discipline as the
ranking weights, which are rejected rather than normalised.

---

## 6. Remove the plan approval gate; keep the send gate

Delete the `approvalGate` step (`composition.ts:261-313`). The run goes
`compile → plan → parallel fan-out → synthesize`.

The human gate that matters is already correct and stays: every draft lands as
`pending_approval` (`business-local.ts:340-351`) behind
`POST /api/messages/[id]/approve`. Nothing external happens without a person.

Consequent dead code to remove: `resumeCampaignWorkflow` (`apps/web/lib/workflows.ts:55`) and
its call from `approveCampaign`. `requestPlanApproval` and `recordPlanDecision` leave the
`CampaignWorkflowServices` interface.

Leave `ApproveCampaignRequestSchema` and the campaign-approve route in place — they are still
the shape for approvals that are not message-scoped, and removing them is a UI-visible change
that belongs to the UI owner.

---

## 7. Put real candidates in the ranking pool

`defaultRankingAdapters` (`src/orchestrator/adapters.ts:28`) registers **only the six sim
adapters**. The generated adapters in `src/adapters/generated/` are never ranked. Every
capability therefore has exactly one candidate, so the plan screen's ranking table
(`campaign-workspace.tsx:154`) renders one row and no losers.

`docs/PLAN.md` names this as a risk in its own words: *"Ranking looks like theatre if every
capability has one candidate."* It currently is.

Register `generatedMarketGeoAdapter`, `generatedMarketWebAdapter`,
`generatedMarketReviewsAdapter` and `generatedMarketPeopleAdapter` with `mode: "generated"`
and their declared profiles. Their existing profiles should already differ from the sim ones on
cost and coverage; if they do not, that is the bug to fix — the ranking must have a real choice
to make, and sim should win honestly on the fixture's home turf rather than by being alone.

---

## 8. Emit `droppedCount`

The evidence drawer says so itself (`campaign-workspace.tsx:189`): *"The dropped-claim count is
not exposed by the current detail or SSE contract."*

The value is already computed and persisted (`business-local.ts:228`). Emit the
`assessment.recorded` event from §1 at that point in the target pipeline. No new computation,
no new storage.

---

## The seven engineering rules

Unchanged — see `docs/tasks/README.md`. Rules 3 and 6 carry the most weight here: the
generalisation in §3 is where a stray `as` or a defensive `?.` would slip in. If a motion field
can be absent, the schema says so.

## Done when

- [ ] One migration adds `target.motion_id` and `workspace.connected_sources`; `db:push` applies
- [ ] `declineReason()` is gone; `business.online` plans and executes end to end from a prompt
      naming online companies
- [ ] `consumer.ads` and `consumer.email` are **still declined**, now citing the unconnected
      workspace source
- [ ] One pipeline serves both organization motions; `grep -n '"business.local"'
      src/mastra/workflows/` returns nothing outside registry lookups
- [ ] An objective naming a city outside the fixture discovers targets in that city
- [ ] `POST /api/campaigns` with `{ workspaceId, objective }` alone starts a run; the campaign
      row carries the compiled name and budget before planning
- [ ] An inferred budget outside the schema bounds is rejected, not clamped
- [ ] No plan approval gate; a run reaches `pending_approval` drafts without human input, and
      no message sends without one
- [ ] Every ranked capability shows ≥2 candidates with different scores and a stated loser reason
- [ ] `assessment.recorded` streams with a `droppedCount`
- [ ] `pnpm typecheck` and `pnpm check` green; `pnpm test` passes; existing policy, ranking,
      evidence and ledger tests pass **unchanged**
- [ ] `grep -rn " as \| any" src/motions src/orchestrator src/mastra/workflows` returns nothing
- [ ] Handoff note written below

---

## Unblocked UI work — for the UI owner, not this task

1. `campaign-create-form.tsx:11,44-49` — send `{ workspaceId, objective }` only. Delete
   `campaignName()`, `defaultOperatingCeilingCents`, `defaultCommitCeilingPaise`.
2. `campaign-workspace.tsx:161` — the motion column derives from target kind
   (`target.kind === "person" ? "creator" : "business.local"`), which will label every online
   target as local. Read `target.motionId` instead; §1 puts it there.
3. `campaign-create-form.tsx:123` — *"You'll review the plan before anything runs"* stops being
   true once §6 lands. The accurate promise is that nothing is **sent** without approval.
4. `campaign-workspace.tsx:189` — the dropped-claims placeholder can render the real count from
   the `assessment.recorded` event.

## Handoff note

Implemented the autonomous backend spine: objective-only campaign creation now compiles once,
writes the authoritative name/budget before planning, derives motion eligibility from adapter
rankings and connected workspace sources, and proceeds directly into selected motion execution.
Local and online organizations share one evidence/assessment/draft pipeline, persist their motion,
and emit `assessment.recorded` with the verified dropped-claim count. Geography is carried into
simulation filtering and generated-world identity, and sim/generated candidates now compete in
the ranking pool.

Migration `0001_organic_ozymandias.sql` adds both columns. It was generated successfully, but was
not pushed from this workspace because `DATABASE_URL` was not configured; the next environment
with a database connection must run `pnpm db:push`. The campaign approval route remains for the
UI-visible non-message approval contract, but campaign workflow resumption is intentionally gone;
message approval remains the outbound send gate.
