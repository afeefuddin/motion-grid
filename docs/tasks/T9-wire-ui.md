# T9 · Wire the UI

**Wave 3 · ~2h · depends on T5, T6, T7, T8**

Replace T5's mocks with real endpoints and the live SSE stream. This should be a small,
boring diff. If it isn't, a contract drifted somewhere and that's the real finding.

## Owned paths (exclusive write)

```
app/**          (everything EXCEPT app/api/**)
components/**
src/mocks/**    (deleting it)
```

## Read-only

Everything else. **Do not "fix" a backend file to make the UI work** — raise it with whoever
owns that path.

## Deliverables

1. Swap the mock module for real `fetch` calls and a real `EventSource` against
   `GET /api/stream/:runId`.
2. Delete `src/mocks/**`.
3. Wire the two human gates: **Approve plan** (resumes T6's suspended workflow) and
   **Approve message** (triggers T7's send).
4. Loading and empty states on every screen — an empty grid before a run starts should look
   deliberate, not broken.
5. Reconnect handling on the SSE stream. A dropped connection mid-demo must recover, not
   freeze at 40 of 60 rows.

## Read first

T5's, T6's and T7's handoff notes — especially T7's on the SSE connection and T6's on the
suspend/resume contract.

## The one thing that can go wrong

If a screen needs data no endpoint returns, the temptation is a cast or a `?? []`. Don't. Rule
3 and rule 6 exist for exactly this moment. Either the endpoint is wrong or the contract is —
find out which, and say so in your handoff.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. Parse at the edge — API responses are already contract-typed; don't re-validate everywhere.
3. **Zero `as`. Zero `any`.**
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **None are in this task.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining to paper over a missing field.
7. Adapters are pure w.r.t. their contract.

## Done when

- [ ] Every screen runs on real data; `src/mocks/` deleted
- [ ] Grid streams live from SSE, including reconnect
- [ ] Both approval gates work end to end
- [ ] Cost ticker shows real spend — USD operating, INR commit, separately
- [ ] Warm-intro badge appears from real discovered edges
- [ ] `grep -rn " as \| any" app components` returns nothing
- [ ] Handoff note written

---

## Handoff note

_(fill in — especially any contract mismatch you found)_
