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

Approved WhatsApp drafts are delivered through the separately hosted `whatsapp-web.js` service. Configure `WHATSAPP_SERVICE_URL`, `WHATSAPP_SERVICE_API_KEY`, `WHATSAPP_FROM`, and the server-side `WHATSAPP_ALLOWED_RECIPIENTS` allowlist. The VM service and systemd/Caddy configuration live in `deploy/whatsapp-web-api`.

```bash
curl --request POST http://localhost:3000/api/messages/MESSAGE_ID/approve \
  --header 'Content-Type: application/json' \
  --data '{"approved":true,"decidedBy":"demo-user"}'
```

## Planning documents

- `docs/PLAN.md` — the existing hackathon-specific execution plan
- `docs/PRODUCT.md` — the broader product scope, architecture and guardrails
