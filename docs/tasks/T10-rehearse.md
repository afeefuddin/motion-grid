# T10 · Verify & Rehearse

**Wave 3 · ~2h · depends on everything**

The last task, and the one most likely to get cut. Don't cut it. A demo that has never been
run end to end will fail on stage — this is the task that finds out why while there's still
time to fix it.

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
| Typecheck | `pnpm typecheck` clean |
| **No casts** | `grep -rn " as \| : any" src app \| grep -v node_modules` returns nothing. A hit means a contract is wrong — report it, don't cast |
| Tests | `pnpm test` green |
| **Evidence verification** | every persisted documentary signal satisfies `normalize(source).includes(normalize(excerpt))`; `droppedCount` recorded |
| **Offline run** | network disabled to sim adapters → 60-target campaign reaches `draft_ready` with zero errors |
| **Determinism** | same objective + seed twice → identical targets and identical signals. Divergence means the sim leaks randomness and run two will embarrass you on stage |
| **Operating budget** | cap set to $0.50 → run pauses, policy reason surfaced in the UI |
| **Commit budget** | `max_per_deal` below a creator's rate → excluded from roster with a stated reason |
| **Live send** | one WhatsApp + one email deliver; reply webhook writes an `interaction`; grid updates without refresh |
| **Beta/API degradation** | if any optional model feature is unavailable, the run still completes |

## 2. Rehearse

**Three clean runs, then one with wifi off.** The offline run should get everything except the
live send — confirm it degrades visibly rather than hanging.

Time each beat. If the Grid takes 90 seconds to fill, reduce target count until it lands
around 35 — pacing beats volume on stage.

## 3. `docs/DEMO.md`

The run of show, with timings:

1. **0:00** — "GTM tools got better at writing emails and reply rates fell below 1%. The
   problem isn't the writing — it's that there's no reason to reply."
2. **0:15** — Objective. Plan streams: three motions, budget split operating (USD) vs commit
   (₹), policy list, approval gate.
3. **1:00** — Approve. Grid fills with mixed-motion rows. Ticker climbs.
4. **1:40** — Evidence drawer. "Every excerpt is checked against the source before we store
   it. Two claims got dropped on this lead — you can see the count."
5. **2:25** — Warm-intro badge. "A creator this campaign found already posted about this
   salon. Two motions, one graph."
6. **2:50** — Approval queue → approve. **"Check your phone."**
7. **3:25** — Reply arrives. Grid flips to `engaged` live.
8. **3:45** — "The market data is simulated. The reasoning, the policies, the verification,
   the messages and that WhatsApp are real. Swapping the sim adapter for a real one is a
   single line — the agent doesn't change."

Include: the exact objective text to type, which lead to open in the drawer, which row has the
warm-intro badge (from T8's handoff), and the Twilio join phrase.

## 4. Fallbacks

- **Record a screen capture of a full successful run.** This is the ultimate insurance and
  takes ten minutes.
- Pre-join the demo phone to the Twilio sandbox the night before.
- Have the plan-screen state reachable directly by URL in case the objective compile is slow.

## Done when

- [ ] Every row in the verification table passes
- [ ] Three clean rehearsals, plus one offline
- [ ] `docs/DEMO.md` written with real timings
- [ ] Screen capture recorded
- [ ] Demo phone pre-joined to the Twilio sandbox
- [ ] Known-issues list handed to whoever presents

---

## Handoff note

_(fill in — what broke, what's fragile, what the presenter must avoid touching)_
