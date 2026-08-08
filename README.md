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
npm install
cp .env.example apps/web/.env.local
cp .env.example apps/agent-runtime/.env
npm run dev:agents
npm run dev:web
```

The web app runs on `http://localhost:3000`; Mastra Studio/server uses `http://localhost:4111` by default.

The scaffold intentionally keeps provider calls and persistent repositories as explicit placeholders. It demonstrates the runtime boundaries without pretending that external actions or durable domain storage already exist.

## Planning documents

- `docs/PLAN.md` — the existing hackathon-specific execution plan
- `plan.md` — the broader product scope, architecture and guardrails
