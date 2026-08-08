# MotionGrid Agent-Run UX

Status: Product UX reference  
Scope: The experience after a campaign is planned and while agents are executing it

## Product intent

MotionGrid should feel like live flight tracking for a GTM campaign. The operator should always be able to answer:

1. What is happening now?
2. What has been accomplished?
3. Why did the system make this decision?
4. What is it costing?
5. Does it need me?

The interface should show verified work appearing, not expose model chain-of-thought or fill the screen with token-level activity.

The primary user is a founder or GTM operator supervising several consequential actions. They need confidence and control without having to inspect raw logs. The experience should feel calm, precise, observable, and interruptible.

## Design direction

### Domain vocabulary

Territory, routes, targets, signals, evidence, checkpoints, approvals, spend ledger, handoffs, and outcomes.

### Color world

- Map parchment or quiet neutral canvas
- Graphite roads and structural text
- Route blue for active work
- Verified green for supported conclusions
- Approval amber for human gates
- Exception coral for failures and policy refusals
- Muted gray for rejected or ineligible targets

Color must communicate state. It should not be decorative.

### Signature interaction: the Live Campaign Route

Every agent action updates one connected surface:

```text
Campaign route
      -> map pin or target row
      -> evidence and qualification
      -> approval
      -> message and response
```

Selecting an object anywhere should highlight it everywhere. Selecting a map pin should focus its Grid row, current activity, evidence, and proposed next action. Selecting a Grid row should highlight its map pin or other motion-specific representation.

### Defaults to avoid

- Chat transcript -> use semantic activity receipts.
- Indeterminate spinner -> use a measurable campaign route and throughput.
- Disconnected dashboard cards -> use a linked map, Grid, evidence, and approval system.
- Fake agent avatars -> show capabilities, providers, actions, and outcomes.
- Confident-looking but approximate map pins -> expose location accuracy.

## Core running experience

### 1. Campaign command strip

A persistent strip at the top of the run should contain:

- Current campaign phase and run state
- Targets examined versus expected
- Qualified, rejected, failed, and pending counts
- Operating spend in USD and committed spend in INR, never summed
- Stream connection and recovery state
- Pending approval count
- Pause, resume, cancel, and review-approval actions

Example:

```text
Running / Discovery    42 of 120 examined    18 qualified / 24 rejected
$4.82 operating        Rs 0 committed        Connected        Pause
```

Only show an ETA after enough throughput exists to estimate a useful range. Prefer "about 3-6 minutes" over false second-level precision.

### 2. Live territory map

For `business.local`, the map should make discovery spatial and tangible:

- Add targets as agents discover them.
- Briefly pulse a pin only when it first appears.
- Cluster dense areas.
- Encode target state through pin color and shape.
- Highlight the corresponding Grid row when a pin is selected.
- Highlight the corresponding pin when a Grid row is hovered or selected.
- Provide a `Follow live` mode that tracks current work.
- Disable `Follow live` when the operator manually pans or zooms.
- Show search boundaries or locality coverage as quiet overlays.
- Preserve rejected targets as muted pins instead of removing them.

Location precision must remain truthful:

- Exact provider coordinates -> normal pin.
- Address-level geocode -> pin labeled `Address matched`.
- Locality-only result -> translucent area or locality marker.
- Unresolved location -> keep it in the Grid without inventing a pin.

The current organization target payload has `address` and `locality`, but no latitude, longitude, accuracy, or geocoding provenance. The contract must be extended before a trustworthy live map is implemented.

The map is motion-specific, not the universal execution metaphor:

- `business.local` -> territory map
- `creator` -> creator/business relationship graph
- `consumer` -> cohort or lifecycle funnel
- Mixed-motion campaign -> Grid as the stable cross-motion view

### 3. Semantic activity rail

The activity rail explains observable work in plain language:

- `Found 18 gyms in Indiranagar`
- `Checked Iron Temple's booking flow`
- `Rejected FitSpace - online booking verified`
- `Qualified CoreLab - phone-only booking and repeated wait complaints`
- `Finding a decision maker for CoreLab`
- `Paused before sending 7 WhatsApp drafts`

Each receipt may expand to show:

- Capability and provider
- Start time and duration
- Incremental cost
- Target
- Source or evidence created
- Failure or retry details

Do not display hidden reasoning, raw model scratch work, streaming tokens, or noisy low-level events by default.

### 4. The Grid

The Grid is the durable record of accumulated work across all motions.

Target progression:

```text
discovered -> observed -> scored -> fit or not_fit -> contact_found
-> draft_ready -> pending_approval -> sent -> delivered -> engaged
```

Grid behavior:

- Stream rows into the table as targets appear.
- Animate insertion subtly; avoid constant reshuffling.
- Keep `not_fit`, suppressed, and failed rows visible with reasons.
- Sort by assessment score, recency, cost, and state.
- Show a compact state trail per target.
- Preview `Why qualified?` or the rejection reason in the row.
- Show motion as a column and filter.
- Show the warm-introduction indicator when a `mentions` edge exists.
- Offer saved views such as `High confidence`, `Needs approval`, `Failed`, and `Replied`.
- Support bulk actions only when policy explicitly permits them.

### 5. Evidence drawer

Opening a pin, row, or activity receipt should lead to the same target evidence drawer.

Show:

- Source reference and observation time
- Relevant excerpt
- Verified or unverified state
- Agent implication
- Evidence strength or statistical comparison
- Number of unverifiable claims discarded
- Assessment score and rubric
- The exact proposed-message sentence supported by each evidence item

The proof chain is a product feature. MotionGrid should communicate `why this target and why this action`, not merely report that AI selected it.

### 6. Approval takeover

Approval is an interrupt, not a log item.

When human input is required:

- Show a persistent approval beacon in the command strip.
- Open or offer a focused right-side drawer.
- State the consequence in plain language, for example: `Approving sends 7 WhatsApp messages`.
- Show the affected audience, channel, projected cost, evidence-linked draft, and policy reason.
- Offer approve, edit, reject, and pause-campaign actions.
- Record who decided and when.

Plan approval and per-message approval remain separate gates.

### 7. Visible replanning

Provider failures, budget refusals, or policy denials must not disappear into an activity log.

Show a compact route amendment:

```text
Google Places unavailable
          -> campaign paused for 1.4s
          -> discovery switched to Outscraper
          -> projected operating cost changed by +$1.80
```

The old route or binding should remain visible with a strike-through treatment. Show the replacement, trigger, budget effect, and whether operator approval is required.

### 8. Catch-up and notifications

When an operator returns to a running campaign, begin with a short delta summary:

```text
Since you left: 31 targets examined, 9 qualified, 1 provider switch,
and 7 messages waiting for approval.
```

Notify outside the page only for meaningful events:

- Approval required
- Campaign paused or failed
- Budget threshold crossed
- High-value reply or meeting booked
- Campaign completed

Do not notify for every target or tool call.

## Motion and interaction principles

- Motion communicates change, ownership, or causality; it is not decoration.
- Newly discovered targets may pulse once, then settle.
- State changes should transition quickly and smoothly without bounce.
- Preserve the operator's scroll, selection, map viewport, and table sort while events arrive.
- Never reorder the Grid beneath the pointer unless the operator explicitly selected live sorting.
- Respect reduced-motion preferences.
- Use an assertive visual change for approvals and failures, but keep routine work calm.
- Make loading, empty, disconnected, reconnecting, partial-failure, and completed states deliberate.

## Accessibility requirements

- Do not encode state by color alone; combine color with text, icon, or shape.
- Every map operation must have an equivalent Grid operation.
- Announce meaningful state changes through a restrained live region.
- Do not announce every streamed event to screen readers.
- Maintain keyboard focus when drawers open and close.
- Pause automatic viewport following when the user interacts with the map.
- Provide accessible labels for pin state, target name, location accuracy, and selection.
- Ensure controls have default, hover, active, focus, disabled, loading, and error states.

## Runtime UX harness

Build the harness before polishing individual visualizations. All live and replayed events must pass through the same state projection.

### Single event projection

Use one pure projection boundary:

```ts
projectRun(previousState, event) => nextState
```

It should own:

- Campaign phase and run status
- Target state and location
- Evidence and assessments
- Discovered relationships
- Operating and committed costs
- Approvals
- Messages and interactions
- Provider failures and replans
- Stream connection health

Components render this projected state. They must not independently infer campaign truth from event prose.

### Live and replay parity

- Live mode consumes the real SSE endpoint.
- Replay mode consumes a recorded transcript parsed through the same contract schemas.
- Both feed the same projector and UI components.
- Preserve the repository rule of one fixture module rather than building a parallel mock architecture.

### Harness controls

- Play, pause, restart, and single-step
- 0.5x, 1x, 4x, and instant playback
- Seek to an event or checkpoint
- Inspect the selected event payload
- Fixed clock and random seed
- Stable target and map output
- Simulate foreground/background tab behavior

### Contract gaps to resolve

Before implementing the full experience, define structured data for:

- Target discovery details available at event time
- Latitude, longitude, location accuracy, geocoding provider, and observation time
- Semantic run phases
- Capability/tool call started, completed, and failed receipts
- Explicit replan event with old binding, new binding, reason, and cost impact
- Pause, resume, and cancel commands
- Client-visible connection, retry, and recovered states

Do not parse `plan.delta` prose to infer structured runtime behavior.

## Required harness scenarios

Every scenario must be deterministic and replayable:

1. Successful local-business discovery and qualification
2. Many rejected targets with visible reasons
3. Plan approval required
4. Message approval required
5. Provider failure followed by successful replan
6. Provider failure with no valid fallback
7. Budget warning and budget refusal
8. Partial target failures while the rest continue
9. Stream disconnect and reconnect using the last event ID
10. Duplicate and out-of-order event delivery
11. Empty discovery results
12. Pause, resume, and cancel
13. Message sent, delivered, replied to, and meeting booked
14. Approximate and unresolved locations
15. Operator leaves and returns to a catch-up summary
16. Reduced-motion and keyboard-only operation

## Recommended implementation order

### Phase 1: Runtime truth

- Extend contracts for location, semantic activity, replanning, and controls.
- Define event identity, ordering, deduplication, and reconnect behavior.
- Build the pure run projector and tests.

### Phase 2: Deterministic harness

- Add the contract-parsed recorded transcript.
- Add playback, stepping, speed, and fault controls.
- Cover the required scenarios.

### Phase 3: Control-room shell

- Build the campaign command strip.
- Build the semantic activity rail.
- Wire the existing plan and Grid requirements to projected state.
- Add connection, empty, paused, failed, and completed states.

### Phase 4: Linked work surfaces

- Add the `business.local` territory map.
- Link map selection, Grid selection, and activity selection.
- Add the evidence drawer.
- Add motion-specific creator and consumer views later.

### Phase 5: Human control

- Build the approval takeover.
- Implement pause, resume, cancel, edit, approve, and reject flows.
- Add visible replanning and budget changes.

### Phase 6: Resilience and polish

- Verify reconnection, deduplication, partial failure, and background-tab behavior.
- Add catch-up summaries and meaningful notifications.
- Complete accessibility and reduced-motion testing.
- Tune motion only after all state transitions are correct.

## Success criteria

The UX is successful when an operator can, within a few seconds:

- Identify what the campaign is doing now
- Understand progress without opening logs
- See why a target qualified or was rejected
- Distinguish exact, approximate, and unresolved locations
- Understand operating and committed spend separately
- Notice and handle an approval request
- See when and why the system replanned
- Pause or stop consequential work
- Leave and return without losing context

The core product signature is:

> Pin or target -> evidence -> approval -> outcome

Every implementation decision should strengthen that chain.
