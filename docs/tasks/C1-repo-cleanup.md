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
packages/**                                          (three deleted, one relocated — see §1–2)
apps/agent-runtime/**                                (deleting)
src/adapters/live/**                                 (creating — pure file move only)
apps/web/app/api/messages/** · apps/web/lib/twilio-webhook.ts
                                                     (import paths only, zero logic change)
package.json · tsconfig.json · tsconfig.base.json · pnpm-workspace.yaml
next.config.ts · biome.json · .gitignore · README.md
plan.md → docs/PRODUCT.md                            (moving)
```

## Read-only

Everything else under `src/**`. **Do not touch `src/contracts/`** — C2 owns the one amendment we
are making, and it is the only one.

## Forbidden

Changing the **behaviour** of any delivery code. §2 is a file move and an import-path rewrite.
Not a refactor, not a cleanup, not a "while I'm here". See §2's proof requirement.

---

## 1. Delete three of the four packages

```
packages/domain/          three-motion enum, competing campaign/plan schemas
packages/database/        competing CampaignRepository / ApprovalRepository
packages/policy/          competing PolicyDecision + evaluateAction
```

Superseded by `src/contracts/`, `src/db/repositories/`, and `src/policy/` respectively.

## 2. Relocate the live integrations — pure move

`packages/integrations` holds **184 lines of working provider code** against the real `twilio`
and `resend` SDKs. It is not scaffolding and it is not going anywhere. It is, however, in the
wrong place: PLAN.md's ownership table puts live adapters at `src/adapters/live/**`, alongside
`src/adapters/sim/**` and `src/adapters/generated/**`. A workspace package holding two files
that only the main app imports is machinery without a job.

Move it:

| From | To | Note |
|---|---|---|
| `packages/integrations/src/twilio-whatsapp.ts` | `src/adapters/live/twilio-whatsapp.ts` | `twilio` SDK — E.164 validation, status callbacks, typed errors, `validateTwilioWebhook` |
| `packages/integrations/src/resend-email.ts` | `src/adapters/live/resend-email.ts` | `resend` SDK — idempotency keys, typed errors |
| `packages/integrations/src/index.ts` lines 23–24 | `src/adapters/live/index.ts` | the two `export *` lines, nothing more |
| `packages/integrations/src/index.ts` lines 1–21 | **deleted** | `CapabilityEstimate`, `CapabilityAdapter`, `LocalBusinessResult` — the pre-T0 adapter interface, superseded by `src/capabilities/adapter.ts`. Verified imported nowhere |

Then:

- Hoist `twilio` and `resend` from `packages/integrations/package.json` into the root
  `package.json` dependencies, at the same versions (`twilio ^6.0.2`, `resend ^6.18.1`).
- Delete `packages/` entirely and reduce `pnpm-workspace.yaml` to `apps/*`.
- Update the three importers from `@motiongrid/integrations` to the new path, and drop
  `@motiongrid/integrations` from `apps/web/package.json`:
  ```
  apps/web/app/api/messages/whatsapp/send/route.ts
  apps/web/app/api/messages/email/send/route.ts
  apps/web/lib/twilio-webhook.ts
  ```

**Prove it was a pure move.** `git diff --find-renames` must show the two provider files as
renames with **zero content change**. If either shows a content diff, you have edited delivery
code — revert and redo. The allowlists, E.164 validation and webhook signature verification are
the parts most easily got wrong under time pressure, and they are already right.

**There are two rule violations in this code. Do not fix them here** — `twilio-whatsapp.ts:78`
casts a caught error, and `resend-email.ts:62` uses a non-null assertion. Both sit at a network
boundary where try/catch is permitted, but the cast and the assertion are not. **Record them in
your handoff for T7**, which is refactoring these files behind the `message.send` contract
anyway and can fix them with a working send in front of it.

Confirm before you commit:

```
grep -rn "CapabilityEstimate\|CapabilityAdapter\|LocalBusinessResult\|@motiongrid/" \
  --exclude-dir=node_modules --exclude-dir=.git .
```

Only `apps/web`'s own package name should remain. If anything imports the three deleted
interfaces, **stop** — something was written against them since this brief was authored.

## 3. Delete `apps/agent-runtime`

It is pre-T0: it depends on `@ai-sdk/openai`, `@mastra/libsql`, `@motiongrid/domain` and
`@motiongrid/policy`, none of which survive. Its `authorize-action` tool calls the *deleted*
policy engine. `src/mastra/**` (T0 stub → T4/T6) replaces it entirely.

Git history keeps the old agent prompts if anyone wants them. Do not copy them into `docs/`.

## 4. Leave the rest of the delivery path alone

Beyond the import-path rewrite in §2, none of this changes:

```
apps/web/app/api/messages/whatsapp/send/route.ts    allowlist + E.164 + typed error mapping
apps/web/app/api/messages/email/send/route.ts       allowlist + typed error mapping
apps/web/app/api/webhooks/twilio/whatsapp/route.ts  inbound WhatsApp
apps/web/app/api/webhooks/twilio/status/route.ts    delivery status
apps/web/lib/mastra-client.ts
.env.example                                        Twilio + Resend config
README.md                                           §9 updates the workspace list only
```

T7 owns wrapping all of it behind the `message.send` capability contract so sends run through
`executeCapability` and the policy gate. That is a design change with a working demo depending
on it, and it is not this task.

`apps/web/app/api/campaigns/route.ts`, `app/page.tsx` and `components/campaign-workbench.tsx`
are pre-T0 UI scaffolding. Leave them; T9 replaces them.

## 5. Single Next app at `apps/web`

`apps/web` stays the Next application. Delete the duplicate root `next.config.ts` (the real one
is `apps/web/next.config.ts`). Root `package.json` already delegates via
`dev: pnpm --dir apps/web dev` — keep that shape.

`docs/PLAN.md`, T7, T9 and T10 have already been updated to `apps/web/**`. Your job is to make
the code match: sweep for any remaining `app/**` or `components/**` reference in docs or config
that still assumes the root layout, and correct it. **Do not edit `docs/tasks/T4-*.md` — an
agent is working in it.**

## 6. Make `pnpm typecheck` cover the whole repo

Today root `tsconfig.json` includes only `next-env.d.ts`, `src/**/*.ts`, `drizzle.config.ts`,
`next.config.ts`. `apps/web` is invisible to it — which is exactly why three contradictory type
layers survived three waves unnoticed.

Fix so one `pnpm typecheck` at the root covers `src/**` (which now includes the relocated live
adapters) and `apps/web/**` — either by widening the include or by project references, whichever
is less machinery. Verify by introducing a deliberate type error in each and confirming the root
command fails on both.

## 7. `pnpm test`

`docs/PLAN.md`'s verification section promises `pnpm test`; it doesn't exist. Tests are
currently reached through ad-hoc scripts (`sim:test`) or not at all — `repositories.test.ts` is
in no script and silently needs a live Postgres.

Add a single `pnpm test` that runs every `src/**/*.test.ts` under `node --test`. The repository
suite must **skip with a printed reason** when `DATABASE_URL` is unset, not fail and not hang.

## 8. Fix the stale Biome target list

`pnpm check` hand-lists paths and has fallen behind — it misses `src/db/repositories`,
`src/capabilities`, `src/policy`, `src/ledger`, `src/contracts/smoke.ts`. Replace the list with
whole-directory targets (`src`, `apps/web`) so it cannot drift again.

Biome will now see the relocated live adapters for the first time. If it reports formatting
diffs on them, apply the formatter — that is not a logic change. If it reports a *lint* error,
leave it and record it alongside the two known violations from §2.

## 9. Two plans, one authority

Root `plan.md` is the original product document. It describes a **different architecture** from
the one being built — an orchestrator calling `plan_b2b_campaign(...)` as a tool and a
capability *router* choosing providers. `docs/PLAN.md` is the build plan and is authoritative.

Move `plan.md` → `docs/PRODUCT.md` and add a two-line header:

> Product context and long-term intent. **`docs/PLAN.md` is authoritative for what is being
> built.** Where they disagree, PLAN.md wins.

Do not rewrite its contents.

## 10. Small hygiene

- Update `README.md`'s workspace list. It currently advertises `apps/agent-runtime`,
  `packages/domain`, `packages/database`, `packages/integrations` and `packages/policy` — four
  of which are gone and one of which moved. **Leave the Twilio/Resend setup instructions
  untouched**; they are correct and T7 depends on them.
- Delete `package-lock.json`. `packageManager` is `pnpm@11.16.0` and `pnpm-lock.yaml` is the
  real lockfile; two lockfiles is a trap.
- Confirm `.gitignore` covers `*.tsbuildinfo` (it does) and that no build artefact is tracked.

---

## Done when

- [ ] `packages/**` and `apps/agent-runtime/**` are gone; `pnpm-workspace.yaml` is `apps/*` only
- [ ] **`git diff --find-renames` shows the two provider files as renames with zero content
      change** — this is the one check that matters most in this task
- [ ] `twilio` and `resend` hoisted to root `package.json` at unchanged versions
- [ ] `pnpm install` succeeds with no unresolved workspace dependency
- [ ] The WhatsApp send route, email send route and both webhooks compile and their allowlist
      logic is unchanged
- [ ] `pnpm typecheck` at the root covers `apps/web` — proven by a deliberate error
- [ ] `pnpm test` runs every suite; the DB suite skips with a reason when `DATABASE_URL` is unset
- [ ] `pnpm check` covers `src` and `apps/web` by directory, not by hand-listed path
- [ ] `grep -rn "@motiongrid/" --exclude-dir=node_modules .` returns nothing outside `apps/web`'s
      own package name
- [ ] `plan.md` moved to `docs/PRODUCT.md` with the authority header
- [ ] `README.md` workspace list matches reality; its Twilio/Resend setup section is untouched
- [ ] Any remaining root-layout `app/**` reference in docs or config corrected — **T4 untouched**
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially: the new import path for the live adapters, and the two rule violations
from §2 with their line numbers, so T7 fixes them while it has a working send in front of it.)_
