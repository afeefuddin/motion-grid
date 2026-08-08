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
- [ ] Every send goes through `executeCapability` and the policy gate; a denied send never hits
      the network
- [ ] The inherited allowlists and signature verification still work after the refactor
- [ ] SSE events match `contracts/api.ts` exactly, including C2's orchestration events
- [ ] Orchestration events stream as decisions are made, not batched at the end
- [ ] Live adapters declare an honest `profile` so T5's ranker can weigh them
- [ ] `grep -rn " as \| any" apps/web/app/api apps/web/lib src/adapters/live` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially the tunnel URL setup, Twilio join phrase, what changed in the inherited
routes, and anything T9 needs about the SSE connection)_
