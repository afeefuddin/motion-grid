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
cp .env.example .env
cp .env.example apps/web/.env.local
docker compose up -d postgres
pnpm exec drizzle-kit migrate
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

For a fresh local database, use the committed migrations as shown above. `pnpm db:push` is useful
only for disposable local schema experimentation; it is not the production migration path.

Run the two processes in separate terminals:

```bash
# Terminal 1: Mastra reads the root .env file and serves its API on port 4111.
pnpm dlx mastra@1.23.0 dev

# Terminal 2: Next.js reads apps/web/.env.local.
pnpm dev
```

The web app runs on `http://localhost:3000`.

`DATABASE_URL` must be available to both processes. Mastra also needs `ANTHROPIC_API_KEY` for
the campaign agents and generated-market cache misses; fixture-backed and warm-cache runs do not
use it for market generation. Set `MASTRA_API_URL` in
`apps/web/.env.local` only when Mastra is not at `http://localhost:4111`.

The production Mastra workflow requires GitHub `DATABASE_URL` and `ANTHROPIC_API_KEY` secrets,
applies the committed Drizzle migrations before deployment, and uses Claude for generated-market
cache misses. Resend and WhatsApp credentials belong
to the separate Next.js deployment, not the Mastra runtime.

## Runtime ownership

Campaign runs execute in the Mastra service, not in the Next.js process. Next.js dispatches
campaign commands and proxies an observer stream to connected browsers. Closing a browser tab or
restarting the web app does not cancel a run.

Mastra persists workflow snapshots in PostgreSQL and owns background execution, recovery, and
bounded concurrency. It starts selected motions after compilation and planning; there is no
campaign-plan approval suspension. The only approval gate is each outbound draft: a human must
approve the message before delivery. Campaign, run, conversation, evidence, and result state is
also written to PostgreSQL from inside the workflow so correctness never depends on an SSE
connection being alive.

The root `src/contracts` package is the authoritative Zod contract surface, and
`src/db/schema.ts` is the authoritative Drizzle schema. The web app and Mastra runtime consume
those boundaries as later implementation waves are completed.

Approved email and WhatsApp drafts are delivered through `POST /api/messages/[id]/approve`.
Each effective recipient must be present in the matching app-side allowlist:
`RESEND_ALLOWED_RECIPIENTS` or `WHATSAPP_ALLOWED_RECIPIENTS`. The optional `RESEND_TO_EMAIL`
and `WHATSAPP_TO` values are controlled-demo overrides: when set, they replace the persisted
contact address for every approved send on that channel and must themselves be allowlisted. Unset
them for normal recipient delivery.

WhatsApp additionally uses the separately hosted `whatsapp-web.js` service. Configure
`WHATSAPP_SERVICE_URL`, `WHATSAPP_SERVICE_API_KEY`, and `WHATSAPP_FROM` in the application, and
configure that service's own `ALLOWED_RECIPIENTS` separately. The VM service and systemd/Caddy
configuration live in `deploy/whatsapp-web-api`.

```bash
curl --request POST http://localhost:3000/api/messages/MESSAGE_ID/approve \
  --header 'Content-Type: application/json' \
  --data '{"approved":true,"decidedBy":"demo-user"}'
```

## Planning documents

- `docs/PLAN.md` — the existing hackathon-specific execution plan
- `docs/PRODUCT.md` — the broader product scope, architecture and guardrails
