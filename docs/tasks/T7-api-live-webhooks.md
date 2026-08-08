# T7 · API Routes, Live Delivery, Webhooks

**Wave 2 · parallel with T5, T6, T8 · ~4h · depends on T1, T3, T4, C2**

The only task that touches the outside world. You own the moment the demo lands on someone's
phone — **start the tunnel and Twilio setup in your first fifteen minutes**, not your last.

## Owned paths (exclusive write)

```
apps/web/app/api/**
apps/web/lib/**
src/adapters/live/**
```

## You are inheriting working code — read this first

**Live delivery already works.** Roughly 300 lines of it exist from before T0, against the real
`twilio` and `resend` SDKs. C1 relocated the provider adapters into your path without changing
a line of their logic; everything else it left alone:

```
src/adapters/live/twilio-whatsapp.ts       Twilio SDK — E.164 validation, status callbacks,
                                           typed errors, validateTwilioWebhook signature check
src/adapters/live/resend-email.ts          Resend SDK — idempotency keys, typed errors
apps/web/app/api/messages/whatsapp/send/   send route: allowlist + E.164 + typed error mapping
apps/web/app/api/messages/email/send/      send route: allowlist + typed error mapping
apps/web/app/api/webhooks/twilio/whatsapp/ inbound WhatsApp
apps/web/app/api/webhooks/twilio/status/   delivery status
apps/web/lib/twilio-webhook.ts             signature verification
.env.example + README.md                   setup for both, already written and correct
```

**Adopt and refactor; do not rewrite.** The allowlists, the E.164 validation and the webhook
signature verification are the parts most easily got wrong under time pressure, and they are
already right. Your job is:

1. Wrap `TwilioWhatsAppAdapter` and `ResendEmailAdapter` in the `Adapter<"message.send">`
   contract from `src/capabilities/adapter.ts`, so sends run through `executeCapability` and
   the policy gate rather than being called directly from a route.
2. Keep the route handlers thin — parse, allowlist, delegate.
3. Fix the two known rule violations C1 recorded: a cast on a caught error in
   `twilio-whatsapp.ts` and a non-null assertion in `resend-email.ts`. You are the only task
   that touches these files with a working send in front of it.

**Decide and document the throw/return boundary.** Both inherited adapters throw typed errors;
`executeCapability` has no try/catch, so a throw propagates to T6's `.foreach()` catch. That is
consistent with rule 4, but rule 5 says errors are values inside the pipeline. Pick one, apply
it to both adapters, and say which in your handoff — T6 needs to know.

Read C1's handoff note before you start.

## Read-only

`src/contracts/**` (frozen again after C2 — especially `contracts/api.ts`) ·
`src/db/repositories/**` (T1) · `src/capabilities|policy|ledger/**` (T3) ·
`src/orchestrator/**` (T5) · `src/mastra/**` (T4/T6)

Implement the `Adapter` interface from **T3's handoff note** — the same one T2's sim adapters
implement — including the `profile` metadata C2 added. Declare it honestly: the live adapters
are the ones whose `expectedConfidence` and cost should make T5's ranker prefer them when the
objective calls for real data, and avoid them when it doesn't.

## Forbidden

`apps/web/app/**` outside `api/` (T9), everything else in `src/`.

## Deliverables

### 1. Route handlers — `apps/web/app/api/**`

**`POST /api/campaigns` does not exist any more.** C1 deleted the pre-T0 version: it called a
`plan-campaign` workflow in the deleted `apps/agent-runtime` and parsed against a `CampaignPlan`
shape that no longer exists. You are writing it fresh against T6's `campaignWorkflow`.

```
POST   /api/campaigns                  create → compile objective (streams)
GET    /api/campaigns                  list
GET    /api/campaigns/:id              detail + targets
POST   /api/campaigns/:id/approve      resume the suspended workflow
POST   /api/campaigns/:id/run          start a run
GET    /api/stream/:runId              SSE — the event union from contracts/api.ts
POST   /api/messages/:id/approve       approve one draft → triggers send
POST   /api/webhooks/twilio            inbound WhatsApp
POST   /api/webhooks/resend            delivery + open events
```

Validate every request body with its contract schema at the top of the handler. That is a
parse boundary — after it, the type is known and no further checking is needed.

### 2. SSE stream

`GET /api/stream/:runId` emits the event union in `contracts/api.ts`. Do not invent event
shapes; if you need one that isn't there, **stop and escalate**.

C2 added the orchestration events — `motion_selected`, `motion_declined`, `capability_ranked`,
`binding_chosen`, `policy_warning`, `replan_started`. These drive the plan screen, which is the
demo's hero. Emit them as T5's orchestrator produces the decisions, not batched at the end;
watching the ranking resolve is the point.

Set `Cache-Control: no-store`, `Connection: keep-alive`, and send a heartbeat so proxies don't
drop the connection mid-demo.

### 3. Live adapters — `src/adapters/live/**`

There is **one** `message.send` capability with a `channel` field, not one per channel — check
`contracts/enums.ts` before you design around the older PLAN.md wording.

| Adapter | Capability | Channel | Notes |
|---|---|---|---|
| `twilio.whatsapp` | `message.send` | `whatsapp` | **Twilio WhatsApp sandbox** |
| `resend.email` | `message.send` | `email` | Resend test domain |

**WhatsApp is the primary channel** — we're demoing to an Indian audience where WhatsApp is
how local businesses actually transact. Format messages as WhatsApp messages: short, no
subject line, no email signature block.

**Do not build SMS.** Sending SMS to Indian numbers requires DLT registration with a telecom
operator — days of lead time. WhatsApp via the Twilio sandbox sidesteps it entirely.

Every send passes through T3's policy gate first. A `deny` or `require_approval` must never
reach the network.

### 4. Inbound reply → live grid update

```
webhook → verify signature → replyClassifier agent (T4)
        → interactionRepo.create → emit SSE → grid flips to `engaged`
```

This is demo beat 7. It must work without a page refresh.

## Setup — do this first, it has lead time

| Thing | Action |
|---|---|
| Public webhook URL | `cloudflared tunnel` — hour one, not hour four |
| Twilio WhatsApp sandbox | Each recipient texts a join phrase once. **Pre-join the demo phone the night before** |
| Fallback | If Twilio fights you, a **Telegram bot is ~10 minutes** and needs no approval. Build behind the same `message.send` contract so nothing else changes |
| Resend | Bare domain only sends to your own address — that is exactly the demo case. **Do not attempt domain verification** |

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. **Parse at the edge** — request bodies and webhook payloads. This task owns two of the
   three parse boundaries.
3. **Zero `as`. Zero `any`.**
4. try/catch in exactly three places — **this task owns two of them**: the network call inside
   a live adapter, and the API route handler. Nowhere else.
5. Errors are values inside the pipeline.
6. No defensive optional chaining.
7. Adapters are pure w.r.t. their contract — the live adapter's only impurity is the network
   call itself.

## Done when

- [ ] One WhatsApp message actually delivers to the demo phone
- [ ] One email actually delivers
- [ ] Inbound reply writes an `interaction` and the SSE stream reflects it without a refresh
- [x] Every send goes through `executeCapability` and the policy gate; a denied send never hits
      the network
- [ ] The inherited allowlists and signature verification still work after the refactor
- [x] SSE events match `contracts/api.ts` exactly, including C2's orchestration events
- [x] Orchestration events stream as decisions are made, not batched at the end
- [x] Live adapters declare an honest `profile` so T5's ranker can weigh them
- [x] `grep -rn " as \| any" apps/web/app/api apps/web/lib src/adapters/live` returns nothing
- [x] Handoff note written

---

## Handoff note

Completed in code on 2026-08-08.

- Added the frozen-contract campaign API surface: create/list/detail, campaign approval and run
  start. The route layer only parses request contracts, delegates, and maps errors. The Mastra
  bridge targets `campaignWorkflow`, supplies the complete T6 workflow input, uses the persisted
  run UUID as its Mastra run ID, resumes `approval-gate` with
  `{ approved, reviewerId: decidedBy }`, and forwards exact `SseEventSchema` values from direct or
  nested workflow stream payloads immediately.
- The integration pass persists a pending plan approval before suspension, links the run to the
  plan, and streams motion selection, declines, capability rankings, chosen bindings, approval,
  and `replan_started` events through Mastra's step writer in decision order.
- Added `/api/stream/:runId` with exact schema validation, in-process ordered replay (up to 500
  events), `Last-Event-ID` continuation, 15-second heartbeats, `Cache-Control: no-store`,
  `Connection: keep-alive`, and proxy buffering disabled. T9 should open one `EventSource` per run
  and apply events as they arrive; reconnects replay events after the browser's last event ID.
- `TwilioWhatsAppAdapter` and `ResendEmailAdapter` now implement
  `Adapter<"message.send">`, declare live cost/profile metadata, and return the frozen provider
  reference/status/timestamp output. WhatsApp rejects subjects and uses short body-only messages;
  email requires a subject and sends plain text. The caught Twilio error cast and Resend non-null
  assertion are gone.
- The throw/return boundary is deliberate: policy decisions are values. A deny or
  `require_approval` is persisted in the approval row and returned without invoking the adapter.
  Provider/network failures remain typed throws (`TwilioWhatsAppError` or `ResendEmailError`)
  because the frozen `message.send` output has no error variant; the API catch maps them and T6's
  per-target catch can turn them into its step-result error value.
- `/api/messages/:id/approve` loads the persisted draft/contact/campaign, evaluates approval,
  suppression, operating-budget, and per-run channel rate-limit policies, enforces the inherited
  environment allowlists, then calls `executeCapability` with a persisted tool-call writer. Only
  an allowed decision can reach Twilio or Resend. The two old direct-send routes were removed
  because they had no campaign/run/target context and therefore could not pass the policy or
  ledger contracts without becoming a bypass.
- Added verified `/api/webhooks/twilio`, kept the legacy `/twilio/whatsapp` URL as an alias, and
  made the Twilio status callback persist delivered/failed state. A verified inbound reply is
  matched to its contact, classified by `replyClassifier`, persisted as an interaction, and emits
  `interaction.received` plus `target.state`; replies move the grid to `engaged` and opt-outs add a
  campaign suppression. `/api/webhooks/resend` verifies Svix headers using
  `RESEND_WEBHOOK_SECRET`, persists delivery/open interactions, and emits the same frozen event
  envelope.
- No tunnel was started and no real delivery was claimed: this worktree has blank provider
  credentials, no configured demo-phone join phrase, no `DATABASE_URL`, and Docker Desktop was
  not running. Before rehearsal, start the app and
  `cloudflared tunnel --url http://localhost:3000`, set `PUBLIC_WEBHOOK_URL` to that HTTPS origin,
  configure Twilio inbound at `/api/webhooks/twilio` and status at
  `/api/webhooks/twilio/status`, configure Resend at `/api/webhooks/resend`, and pre-join the demo
  phone using the phrase shown by the Twilio sandbox console.
- Verification completed: `pnpm typecheck`, focused Biome checks, `pnpm test` (28 passing; the DB
  suite skipped because `DATABASE_URL` is unset), `pnpm build`, `git diff --check`, and the
  zero-cast/zero-`any`/zero-optional-chaining grep all pass. The three real-provider acceptance
  checks remain environmental and must be run during rehearsal with credentials.
