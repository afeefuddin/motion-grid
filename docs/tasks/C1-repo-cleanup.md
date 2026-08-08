# C1 · Repo Cleanup

**Wave 1.5 · ~1h · blocking for T6, T8, T9 · can run parallel with T4 and C2**

Mechanical only. **No design decisions in this task** — if something here requires judgement
about behaviour, stop and raise it rather than deciding.

The repo currently carries a pre-T0 architecture alongside the real one. `packages/domain`
declares three motions (`creator | business | consumer`); `src/contracts/enums.ts` declares
five. `packages/policy` exports a second `PolicyDecision` and `evaluateAction` that contradict
`src/policy/`. `packages/database` declares a third `CampaignRepository` shape. None of it is
typechecked, because root `tsconfig.json` includes only `src/**`.

Engineering rule 1 is *one source of truth for types*. Right now there are three. That is the
whole reason this task exists.

## Owned paths (exclusive write)

```
packages/**                      (deleting)
apps/agent-runtime/**            (deleting)
package.json · tsconfig.json · tsconfig.base.json · pnpm-workspace.yaml
next.config.ts · biome.json · .gitignore
plan.md → docs/PRODUCT.md        (moving)
```

## Read-only

Everything under `src/**`. **Do not touch `src/contracts/`** — C2 owns the one amendment we
are making, and it is the only one.

## Forbidden

- `apps/web/app/api/messages/**`, `apps/web/app/api/webhooks/**`, `apps/web/lib/twilio-webhook.ts`
  — see *Preserve* below. These are working integrations. Do not touch them in this task.
- `src/**` behaviour of any kind.

---

## 1. Delete the contradictory packages

```
packages/domain/          three-motion enum, competing campaign/plan schemas
packages/database/        competing CampaignRepository / ApprovalRepository
packages/policy/          competing PolicyDecision + evaluateAction
packages/integrations/    competing CapabilityAdapter interface
```

All four are superseded by `src/contracts/`, `src/db/repositories/`, `src/policy/`, and
`src/capabilities/adapter.ts` respectively. Delete the directories and remove `packages/*`
from `pnpm-workspace.yaml`.

## 2. Delete `apps/agent-runtime`

It is pre-T0: it depends on `@ai-sdk/openai`, `@mastra/libsql`, `@motiongrid/domain` and
`@motiongrid/policy`, none of which survive. Its `authorize-action` tool calls the *deleted*
policy engine. `src/mastra/**` (T0 stub → T4/T6) replaces it entirely.

Git history keeps the old agent prompts if anyone wants them. Do not copy them into `docs/`.

## 3. Preserve — do not delete

These are **real, working integrations** and T7 will adopt them rather than rewrite:

```
apps/web/app/api/messages/email/send/route.ts       Resend send, server-side allowlist
apps/web/app/api/messages/whatsapp/send/route.ts    Twilio WhatsApp send, allowlist
apps/web/app/api/webhooks/twilio/whatsapp/route.ts  inbound WhatsApp
apps/web/app/api/webhooks/twilio/status/route.ts    delivery status
apps/web/lib/twilio-webhook.ts                      signature verification
apps/web/lib/mastra-client.ts
.env.example                                        Twilio + Resend config
README.md                                           the setup instructions for both
```

Leave them exactly where they are and exactly as they are. If one of them imports a deleted
package, **note it in your handoff and leave the import broken** — T7 owns the fix, and a
cleanup task guessing at delivery behaviour is how a working WhatsApp send stops working the
night before a demo.

`apps/web/app/api/campaigns/route.ts`, `app/page.tsx` and `components/campaign-workbench.tsx`
are pre-T0 UI scaffolding. Leave them; T9 replaces them.

## 4. Single Next app at `apps/web`

`apps/web` stays the Next application. Delete the duplicate root `next.config.ts` (the real one
is `apps/web/next.config.ts`). Root `package.json` already delegates via
`dev: pnpm --dir apps/web dev` — keep that shape.

`docs/PLAN.md`, T7, T9 and T10 have already been updated to `apps/web/**`. Your job is to make
the code match: sweep for any remaining `app/**` or `components/**` reference in docs or config
that still assumes the root layout, and correct it. **Do not edit `docs/tasks/T4-*.md` — an
agent is working in it.**

## 5. Make `pnpm typecheck` cover the whole repo

Today root `tsconfig.json` includes only `next-env.d.ts`, `src/**/*.ts`, `drizzle.config.ts`,
`next.config.ts`. `apps/web` is invisible to it. Fix so one `pnpm typecheck` at the root covers
`src/**` and `apps/web/**` — either by widening the include or by project references, whichever
is less machinery. Verify by introducing a deliberate type error in `apps/web` and confirming
the root command fails.

## 6. `pnpm test`

`docs/PLAN.md`'s verification section promises `pnpm test`; it doesn't exist. Tests are
currently reached through ad-hoc scripts (`sim:test`) or not at all — `repositories.test.ts` is
in no script and silently needs a live Postgres.

Add a single `pnpm test` that runs every `src/**/*.test.ts` under `node --test`. The repository
suite must **skip with a printed reason** when `DATABASE_URL` is unset, not fail and not hang.

## 7. Fix the stale Biome target list

`pnpm check` hand-lists paths and has fallen behind — it misses `src/db/repositories`,
`src/capabilities`, `src/policy`, `src/ledger`, `src/contracts/smoke.ts`. Replace the list with
whole-directory targets (`src`, `apps/web`) so it cannot drift again.

## 8. Two plans, one authority

Root `plan.md` is the original product document. It describes a **different architecture** from
the one being built — an orchestrator calling `plan_b2b_campaign(...)` as a tool and a
capability *router* choosing providers. `docs/PLAN.md` is the build plan and is authoritative.

Move `plan.md` → `docs/PRODUCT.md` and add a two-line header:

> Product context and long-term intent. **`docs/PLAN.md` is authoritative for what is being
> built.** Where they disagree, PLAN.md wins.

Do not rewrite its contents.

## 9. Small hygiene

- Delete `package-lock.json`. `packageManager` is `pnpm@11.16.0` and `pnpm-lock.yaml` is the
  real lockfile; two lockfiles is a trap.
- Confirm `.gitignore` covers `*.tsbuildinfo` (it does) and that no build artefact is tracked.

---

## Done when

- [ ] `packages/**` and `apps/agent-runtime/**` are gone; `pnpm-workspace.yaml` updated
- [ ] Every file in *Preserve* is byte-identical to before this task
- [ ] `pnpm install` succeeds with no unresolved workspace dependency
- [ ] `pnpm typecheck` at the root covers `apps/web` — proven by a deliberate error
- [ ] `pnpm test` runs every suite; the DB suite skips with a reason when `DATABASE_URL` is unset
- [ ] `pnpm check` covers `src` and `apps/web` by directory, not by hand-listed path
- [ ] `grep -rn "@motiongrid/" --exclude-dir=node_modules .` returns nothing outside `apps/web`'s
      own package name
- [ ] `plan.md` moved to `docs/PRODUCT.md` with the authority header
- [ ] `app/**` → `apps/web/app/**` updated in PLAN.md, T7, T9, T10 — **T4 untouched**
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially: anything in Preserve that now has a broken import, so T7 knows before
it starts.)_
