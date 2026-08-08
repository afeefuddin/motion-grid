# MotionGrid

MotionGrid is an AI go-to-market engine: one objective enters, a costed and auditable campaign plan comes out, and consequential actions wait for human approval.

## Workspace

- `apps/web` — Next.js product UI and server-side boundary
- `src/contracts` — authoritative Zod contracts
- `src/db` — Drizzle schema and repositories
- `src/adapters` — simulated, generated and live integrations
- `src/mastra` — agents, tools and workflows

## Start locally

```bash
pnpm install
cp .env.example apps/web/.env.local
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

The web app runs on `http://localhost:3000`.

The root `src/contracts` package is the authoritative Zod contract surface, and
`src/db/schema.ts` is the authoritative Drizzle schema. The web app and Mastra runtime consume
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
- `docs/PRODUCT.md` — the broader product scope, architecture and guardrails
