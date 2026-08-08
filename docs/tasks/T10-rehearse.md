# T10 · Verify & Rehearse

**Wave 3 · ~2h · depends on everything**

The last task, and the one most likely to get cut. Don't cut it. A demo that has never been run
end to end will fail on stage — this is the task that finds out why while there's still time to
fix it.

## Owned paths (exclusive write)

```
docs/DEMO.md
scripts/verify.ts
```

Plus targeted fixes anywhere — but **raise them with the owning task's agent** rather than
silently rewriting their code.

## 1. Run the verification suite

| Check | Passes when |
|---|---|
| Typecheck | `pnpm typecheck` clean, **covering `apps/web` as well as `src`** (C1) |
| **No casts** | `grep -rn " as \| : any" src apps/web \| grep -v node_modules` returns nothing. A hit means a contract is wrong — report it, don't cast |
| Tests | `pnpm test` green |
| **Ranking determinism** | same spec twice → identical candidate order and identical scores, with no model call on the second run |
| **Ranking honesty** | every `RankedBinding` contains every candidate considered, losers included, each with a reason |
| **Evidence verification** | every persisted documentary signal satisfies `normalize(source).includes(normalize(excerpt))`; `droppedCount` recorded |
| **No fabricated signals** | no `signal` row traces to fixture or generated-world data rather than to an extraction — spot-check three |
| **Offline run** | network disabled, sim adapters + warm generated cache → 60-target campaign reaches `draft_ready` with zero errors |
| **Determinism** | same objective + seed twice → identical targets and identical signals. Divergence means the sim leaks randomness and run two will embarrass you on stage |
| **Operating budget** | cap set to $0.50 → policy denies, **orchestrator re-plans to a cheaper binding, run continues**, and the plan screen shows the change |
| **Re-plan cap** | force three failures → run fails cleanly with a stated reason, no loop |
| **Commit budget** | `max_per_deal` below a creator's rate → excluded from roster with a stated reason, still visible in the output |
| **Live send** | one WhatsApp + one email deliver; reply webhook writes an `interaction`; grid updates without refresh |
| **Off-script objective** | a pre-warmed generated-market objective completes end to end with no model call at discovery |

## 2. Rehearse

**Three clean runs, then one with wifi off.** The offline run should get everything except the
live send — confirm it degrades visibly rather than hanging.

Time each beat. If the Grid takes 90 seconds to fill, reduce target count until it lands around
35 — pacing beats volume on stage.

Rehearse the **budget-denial re-plan** separately and repeatedly. It is the best beat in the
demo and the one with the most moving parts: a policy decision, an orchestrator re-rank, a
rebind, a live plan-screen update, and a run that keeps going. Know exactly how to trigger it
and exactly how long it takes.

## 3. `docs/DEMO.md`

The run of show, with timings. The pitch is now **how the decision gets made**, so the plan
screen carries more of the time than it used to:

1. **0:00** — "GTM tools got better at writing emails and reply rates fell below 1%. The problem
   isn't the writing — it's that there's no reason to reply. And nobody can tell you why their
   tool picked what it picked."
2. **0:15** — Objective. The plan streams: motions selected, **`consumer.ads` declined with its
   reason**, budget split operating (USD) vs commit (₹).
3. **0:50** — **The ranked adapter table.** "The model didn't pick the provider. It decided what
   mattered for *this* objective — here's its reasoning, in one sentence — and then this ranking
   is deterministic. Every candidate, every score, and why the losers lost. Same objective
   tomorrow, same ranking."
4. **1:25** — Approve. Grid fills with mixed-motion rows. Ticker climbs in two currencies.
5. **1:55** — **Drop the budget.** Policy denies, the orchestrator re-plans, the binding changes
   on screen, the run continues. "It got told no, and it reasoned its way to a different plan."
6. **2:25** — Evidence drawer. "Every excerpt is checked against the source before we store it.
   Two claims got dropped on this lead — you can see the count."
7. **2:50** — Warm-intro badge. "A creator this campaign found already posted about this salon.
   Two motions, one graph."
8. **3:10** — Approval queue → approve. **"Check your phone."**
9. **3:35** — Reply arrives. Grid flips to `engaged` live.
10. **3:50** — "The market data is simulated. The reasoning, the ranking, the policies, the
    verification, the messages and that WhatsApp are real. And that bottom row in the ranking
    table is Outscraper — swapping to it is a config change, because the agent never knew which
    provider it was talking to."

Include: the exact objective text to type, which lead to open in the drawer, which row has the
warm-intro badge (from T8's handoff), how to trigger the budget denial, and the Twilio join
phrase.

**If you have a spare 30 seconds, use them on an off-script objective** — take one from the
audience, let the generated adapter handle a city nobody rehearsed. Only do this if T8's cache
pre-warm covers it, and only if you've rehearsed the cache-miss path once.

## 4. Fallbacks

- **Record a screen capture of a full successful run.** This is the ultimate insurance and takes
  ten minutes.
- T9's `?replay=1` path replays a recorded run against the real components with no backend. Test
  it. It is the second-line fallback if a service is down but the laptop still works.
- Pre-join the demo phone to the Twilio sandbox the night before.
- Have the plan-screen state reachable directly by URL in case the objective compile is slow.

## Done when

- [ ] Every row in the verification table passes
- [ ] Three clean rehearsals, plus one offline
- [ ] The budget-denial re-plan rehearsed until it is boring
- [ ] `docs/DEMO.md` written with real timings
- [ ] Screen capture recorded
- [ ] `?replay=1` fallback tested with the backend stopped
- [ ] Demo phone pre-joined to the Twilio sandbox
- [ ] Known-issues list handed to whoever presents

---

## Handoff note

_(fill in — what broke, what's fragile, what the presenter must avoid touching)_
