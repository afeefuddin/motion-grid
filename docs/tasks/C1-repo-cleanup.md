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
apps/web/app/api/campaigns/route.ts                  (deleting — see §5)
apps/web/components/campaign-workbench.tsx           (deleting — see §5)
apps/web/app/page.tsx                                (two lines only — see §5)
apps/web/app/api/messages/** · apps/web/lib/twilio-webhook.ts
                                                     (import paths only, zero logic change)
apps/web/package.json · apps/web/next.config.ts
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

**Migrating anything to the current contracts.** Where a pre-T0 file can't survive a mechanical
import rewrite, it is deleted and its owning task rebuilds it (§5). If you find a third such
file that §5 doesn't name, stop and raise it rather than porting it yourself.

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
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .
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
README.md                                           §10 updates the workspace list only
```

T7 owns wrapping all of it behind the `message.send` capability contract so sends run through
`executeCapability` and the policy gate. That is a design change with a working demo depending
on it, and it is not this task.

## 5. Delete the pre-T0 campaign scaffolding

Two files depend on `@motiongrid/domain`'s incompatible `CampaignPlan` shape and **cannot be
fixed by an import rewrite**. Delete them rather than migrating them:

| File | Why it goes |
|---|---|
| `apps/web/app/api/campaigns/route.ts` | Calls `mastraClient.getWorkflow("plan-campaign")` — a workflow in `apps/agent-runtime`, which §3 deletes. There is nothing left to migrate it *to*: T6 hasn't built `campaignWorkflow` yet, and **T7 owns `POST /api/campaigns` as an explicit deliverable** |
| `apps/web/components/campaign-workbench.tsx` | This *is* T9's P0 new-campaign screen — "one-box objective → streamed spec → editable form". **T9 owns it** |

Migrating either would mean designing against contracts two unstarted tasks will define. That is
not mechanical work, and this task is mechanical by construction. Disabling them instead of
deleting leaves dead code, which is the disease this task exists to cure.

**Keep the design system.** `apps/web/app/page.tsx`, `apps/web/app/layout.tsx`,
`apps/web/app/globals.css` (862 lines) and `apps/web/components/brand-mark.tsx` import nothing
from `@motiongrid/*`. T9 wants that styling and
`pnpm dev` should still render. In `page.tsx`, delete exactly two lines — the
`CampaignWorkbench` import and the `<CampaignWorkbench />` element. Nothing else.

Then the mechanical remainder:

- `apps/web/next.config.ts` — drop `transpilePackages` entirely. After §2 no workspace package
  remains to transpile.
- `apps/web/package.json` — drop both `@motiongrid/domain` and `@motiongrid/integrations`.

## 6. Single Next app at `apps/web`

`apps/web` stays the Next application. Delete the duplicate root `next.config.ts` (the real one
is `apps/web/next.config.ts`). Root `package.json` already delegates via
`dev: pnpm --dir apps/web dev` — keep that shape.

`docs/PLAN.md`, T7, T9 and T10 have already been updated to `apps/web/**`. Your job is to make
the code match: sweep for any remaining `app/**` or `components/**` reference in docs or config
that still assumes the root layout, and correct it. **Do not edit `docs/tasks/T4-*.md` — an
agent is working in it.**

## 7. Make `pnpm typecheck` cover the whole repo

Today root `tsconfig.json` includes only `next-env.d.ts`, `src/**/*.ts`, `drizzle.config.ts`,
`next.config.ts`. `apps/web` is invisible to it — which is exactly why three contradictory type
layers survived three waves unnoticed.

Fix so one `pnpm typecheck` at the root covers `src/**` (which now includes the relocated live
adapters) and `apps/web/**` — either by widening the include or by project references, whichever
is less machinery. Verify by introducing a deliberate type error in each and confirming the root
command fails on both.

## 8. `pnpm test`

`docs/PLAN.md`'s verification section promises `pnpm test`; it doesn't exist. Tests are
currently reached through ad-hoc scripts (`sim:test`) or not at all — `repositories.test.ts` is
in no script and silently needs a live Postgres.

Add a single `pnpm test` that runs every `src/**/*.test.ts` under `node --test`. The repository
suite must **skip with a printed reason** when `DATABASE_URL` is unset, not fail and not hang.

## 9. Fix the stale Biome target list

`pnpm check` hand-lists paths and has fallen behind — it misses `src/db/repositories`,
`src/capabilities`, `src/policy`, `src/ledger`, `src/contracts/smoke.ts`. Replace the list with
whole-directory targets (`src`, `apps/web`) so it cannot drift again.

Biome will now see the relocated live adapters for the first time. If it reports formatting
diffs on them, apply the formatter — that is not a logic change. If it reports a *lint* error,
leave it and record it alongside the two known violations from §2.

## 10. Two plans, one authority

Root `plan.md` is the original product document. It describes a **different architecture** from
the one being built — an orchestrator calling `plan_b2b_campaign(...)` as a tool and a
capability *router* choosing providers. `docs/PLAN.md` is the build plan and is authoritative.

Move `plan.md` → `docs/PRODUCT.md` and add a two-line header:

> Product context and long-term intent. **`docs/PLAN.md` is authoritative for what is being
> built.** Where they disagree, PLAN.md wins.

Do not rewrite its contents.

## 11. Small hygiene

- Update `README.md`'s workspace list. It currently advertises `apps/agent-runtime`,
  `packages/domain`, `packages/database`, `packages/integrations` and `packages/policy` — four
  of which are gone and one of which moved. **Leave the Twilio/Resend setup instructions
  untouched**; they are correct and T7 depends on them.
- Delete `package-lock.json`. `packageManager` is `pnpm@11.16.0` and `pnpm-lock.yaml` is the
  real lockfile; two lockfiles is a trap.
- Confirm `.gitignore` covers `*.tsbuildinfo` (it does) and that no build artefact is tracked.

---

## Done when

- [x] `packages/**` and `apps/agent-runtime/**` are gone; `pnpm-workspace.yaml` is `apps/*` only
- [x] **`git diff --find-renames` shows the two provider files as renames with zero content
      change** — this is the one check that matters most in this task
- [x] `twilio` and `resend` hoisted to root `package.json` at unchanged versions
- [x] `pnpm install` succeeds with no unresolved workspace dependency
- [x] The WhatsApp send route, email send route and both webhooks compile and their allowlist
      logic is unchanged
- [x] `apps/web/app/api/campaigns/route.ts` and
      `apps/web/components/campaign-workbench.tsx` deleted — **not
      migrated, not commented out**
- [x] `page.tsx` renders; `globals.css`, `layout.tsx` and `brand-mark.tsx` are untouched
- [x] `transpilePackages` gone from `apps/web/next.config.ts`; both `@motiongrid/*` deps gone
      from `apps/web/package.json`
- [x] `pnpm typecheck` at the root covers `apps/web` — proven by a deliberate error
- [x] `pnpm test` runs every suite; the DB suite skips with a reason when `DATABASE_URL` is unset
- [x] `pnpm check` covers `src` and `apps/web` by directory, not by hand-listed path
- [x] `grep -rn "@motiongrid/" --exclude-dir=node_modules --exclude-dir=.next .` returns nothing
      outside `apps/web`'s own package name (`.next/` holds stale build output — ignore it)
- [x] `plan.md` moved to `docs/PRODUCT.md` with the authority header
- [x] `README.md` workspace list matches reality; its Twilio/Resend setup section is untouched
- [x] Any remaining root-layout `app/**` reference in docs or config corrected — **T4 untouched**
- [x] Handoff note written

---

## Handoff note

Live adapters now export from `src/adapters/live/index.ts`; web importers use relative paths to
that entry point. T7 must fix the caught-error cast in `src/adapters/live/twilio-whatsapp.ts:78`
and the non-null assertion in `src/adapters/live/resend-email.ts:62` while refactoring delivery
behind the `message.send` contract.
