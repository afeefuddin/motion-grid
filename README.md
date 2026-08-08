# MotionGrid

MotionGrid is an AI go-to-market engine: one objective enters, a costed and auditable campaign plan comes out, and consequential actions wait for human approval.

## Workspace

- `apps/web` — Next.js product UI and server-side boundary
- `apps/agent-runtime` — separate Mastra agents and workflows
- `packages/domain` — shared Zod contracts
- `packages/database` — domain persistence boundary
- `packages/integrations` — vendor-neutral integration contracts
- `packages/policy` — deterministic action authorization

## Start locally

```bash
pnpm install
cp .env.example apps/web/.env.local
cp .env.example apps/agent-runtime/.env
docker compose up -d postgres
pnpm dev
```

On macOS with Apple's `container` runtime instead of Docker, the equivalent database command
is:

```bash
container run --name motiongrid-postgres \
  -e POSTGRES_DB=motiongrid \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d docker.io/pgvector/pgvector:pg17
```

Then apply the application schema with `pnpm db:push`.

The web app runs on `http://localhost:3000`; Mastra Studio/server uses `http://localhost:4111` by default.

The root `src/contracts` package is the authoritative Zod contract surface, and
`src/db/schema.ts` is the authoritative Drizzle schema. The app and agent workspaces consume
those boundaries as later implementation waves are completed.

The Resend integration is available at `POST /api/messages/email/send`. Add the recipient to `RESEND_ALLOWED_RECIPIENTS`; the route rejects every other address. For a safe provider check, use `delivered@resend.dev` as documented by Resend.

```bash
curl --request POST http://localhost:3000/api/messages/email/send \
  --header 'Content-Type: application/json' \
  --data '{"to":"delivered@resend.dev","subject":"MotionGrid test","text":"Resend is connected."}'
```

The Twilio WhatsApp integration uses the same server-side allowlist at `POST /api/messages/whatsapp/send`. Sandbox recipients must send Twilio's `join <sandbox-code>` message before they can receive a demo message.

```bash
curl --request POST http://localhost:3000/api/messages/whatsapp/send \
  --header 'Content-Type: application/json' \
  --data '{"to":"+919876543210","body":"MotionGrid is connected to WhatsApp."}'
```

Configure these public Twilio callbacks after deployment:

- Incoming messages: `/api/webhooks/twilio/whatsapp`
- Delivery status: `/api/webhooks/twilio/status`

## Planning documents

- `docs/PLAN.md` — the existing hackathon-specific execution plan
- `plan.md` — the broader product scope, architecture and guardrails
