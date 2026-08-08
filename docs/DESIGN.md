# MotionGrid Design Language

Status: Product-wide design contract  
Applies to: Marketing pages and the authenticated MotionGrid application  
Visual reference: The warmth, clarity, and approachability of TryPlayground's interface, adapted for a consequential agentic GTM product

## Design intent

MotionGrid should make complex GTM orchestration feel calm, legible, and inviting. The product handles agents, market evidence, budgets, approvals, provider execution, and live campaign state. The interface must make that machinery understandable without looking like a developer console or a generic enterprise dashboard.

The defining contrast is:

> Serious operational truth presented through a warm, friendly interface.

The system borrows TryPlayground's design grammar—cream surfaces, bold typography, rounded product frames, blue calls to action, illustrated details, and generous section rhythm—without copying its brand assets or childcare imagery. MotionGrid's content, states, workflows, and illustrations remain specific to GTM orchestration.

## Product feeling

Every surface should feel:

- Warm, not sterile.
- Confident, not aggressive.
- Playful, not childish.
- Operationally precise, not technical for its own sake.
- Dense when the work demands it, but never visually frantic.
- Observable and interruptible when agents are acting.

The memorable signature is a precise application surface emerging from a softer illustrated world. The surrounding page can be expressive; the product UI inside it must remain trustworthy.

## Foundation

### Color

Use a warm cream canvas as the default environment and cobalt blue for primary actions and active state.

| Role | Token | Default |
| --- | --- | --- |
| Page canvas | `--cream` | `#fff8e9` |
| Deeper warm surface | `--cream-deep` | `#f7eedb` |
| Product surface | `--paper` | `#fffdf8` or white |
| Primary text | `--ink` | `#171714` |
| Secondary text | `--muted` | `#666158` |
| Primary action / active route | `--blue` | `#3d6df3` |
| Creator motion / exception | `--coral` | `#e96d55` |
| Approval / attention | `--yellow` | `#efb238` |
| Verified / healthy | `--mint` | `#4f9c7e` |

Color communicates meaning inside the product:

- Blue: active work, selection, links, and primary action.
- Green: verified evidence, healthy connections, and completed safe actions.
- Amber: approvals, budget attention, and consequential pending work.
- Coral: exceptions, failures, refusals, and Creator Motion when used as a domain accent.
- Gray: rejected, unavailable, suppressed, or historical state.

Never communicate state by color alone. Pair it with a label, icon, shape, or status text.

### Typography

Use Manrope for the interface and primary display typography. Headlines are bold, tightly tracked, and friendly rather than editorial or futuristic. IBM Plex Mono is reserved for small operational metadata such as event kinds, timestamps, costs, IDs, and live state labels. Newsreader may be used sparingly for human notes or testimonial-like accents.

- Marketing H1: very large, bold, tight line-height, centered when possible.
- Product page title: compact and strong; do not imitate a marketing headline inside the app.
- Section heading: bold and conversational, usually two lines or fewer.
- Body text: comfortable line-height and restrained width.
- Operational metadata: small but readable; never use low contrast to make density disappear.

Avoid generic tech typography, all-monospace interfaces, excessive uppercase labels, and huge gradients in text.

### Shape and depth

- Primary buttons: 8px radius, cobalt fill, restrained blue shadow.
- Product controls: 6–9px radius.
- Marketing and overview cards: 15–22px radius.
- Pills: fully rounded and used for categories, modes, filters, or compact announcements.
- Borders: quiet warm-gray lines rather than heavy outlines.
- Shadows: soft and directional; use them to lift a product frame or pinned note, not every component.

The app should not become a field of identical floating cards. Use borders, section backgrounds, grouping, and shared containers before adding more elevation.

## Composition

### Marketing surfaces

The landing-page pattern is the canonical marketing composition:

1. A narrow cobalt announcement strip.
2. A restrained centered navigation bar.
3. A large centered promise with one primary CTA.
4. A pill-like capability selector.
5. A real product surface emerging from the bottom of the hero.
6. Social or integration proof.
7. Generous alternating explanation sections.
8. Large illustrated bento cards for capabilities.
9. Human proof and a simple final CTA.

Use cream negative space generously. Product imagery should be built from real MotionGrid states and data, not decorative fake charts.

### Authenticated product surfaces

Carry the same language into operational screens without blindly copying the landing-page scale.

- Use cream or warm-gray around the application shell; use white for primary working surfaces.
- Keep the command strip compact and persistent.
- Present the campaign route, Grid, evidence, and approvals as one connected system.
- Prefer a large shared work surface over disconnected dashboard cards.
- Use rounded frames and friendly spacing, but preserve table density and scanning speed.
- Keep one dominant blue active state per view.
- Let approval amber interrupt the page clearly without turning the whole page yellow.
- Use illustrations only for onboarding, empty states, education, or narrative context. Live operational state uses real evidence and data.

## Core component grammar

### Navigation

Navigation is quiet so the product promise or current task remains dominant. Use short labels, subtle chevrons for expandable groups, a plain secondary action, and one blue primary CTA.

### Buttons

- One primary blue action per decision area.
- Neutral gray buttons for secondary navigation or reversible actions.
- Destructive actions use coral and must state the consequence.
- Approval actions use blue or dark ink; amber frames the pending state rather than becoming the default button color.
- Every button needs hover, focus, active, disabled, loading, and error behavior.

### Cards

Use cards for distinct objects or stories, not as a default wrapper for every group. Marketing cards may use soft blue, yellow, mint, or coral backgrounds. Operational cards are primarily white with semantic accents.

Cards should usually contain:

- A small category or status.
- A decisive title.
- One concise explanation.
- A real visual, metric, or action.

### Pills and tabs

Pills are useful for capability modes, campaign phases, filters, and concise status. Selected pills sit on white with a light border and blue foreground. Avoid using pills as decoration or turning every label into a badge.

### Tables and the Grid

The Grid is a durable record, not a spreadsheet cosplay.

- Keep row height compact but breathable.
- Show target, motion, state trail, evidence summary, score, cost, and next action.
- Preserve rejected and failed rows with clear reasons.
- Highlight linked objects consistently across the map, Grid, activity rail, and evidence drawer.
- Do not reorder rows under the pointer unless live sorting is explicitly enabled.
- Use warm separators and quiet zebra or hover treatment instead of boxed cells.

### Generated decision data

- Never render weighted rubrics as one generated paragraph. Separate the decision summary from a scannable criterion list that shows humanized names, weights, and descriptions.
- Label provider-selection reasoning as operational context rather than styling it as a quotation.
- Keep comparison labels and values at normal interface reading sizes; preserve horizontal scrolling when all decision dimensions cannot fit without shrinking text.

### Product visualizations

Maps, graphs, funnels, and routes should use cobalt for active work, green for verified results, amber for approvals, coral for exceptions, and gray for excluded objects.

Visualizations must expose uncertainty. Never invent precise coordinates, scores, causality, or confidence merely to make the graphic look complete.

### Drawers and approvals

Evidence and approval drawers share the main application's rounded, warm-white surface. Approvals are focused takeovers:

- State the consequence first.
- Show the audience, channel, evidence, cost, and policy reason.
- Keep approve, edit, reject, and pause available without hunting.
- Preserve keyboard focus and restore it when the drawer closes.

### Campaign conversation and artifact

The campaign conversation is the primary steering surface. The durable campaign artifact remains directly reachable through dedicated, linkable campaign views rather than competing with the conversation for working space.

- Give the conversation the dominant center panel and keep a compact campaign-context rail visible on wide screens.
- Link the plan, targets, and approvals to dedicated routes from that context rail; preserve the operator's place when navigating back to the conversation.
- Treat each operator message as a change brief tied to one persisted run.
- Show the specific agent or operational stage currently working, then replace running state with a clear completion, approval, or failure receipt.
- Let streamed changes update the fixed artifact in place so the operator can see what the conversation changed.
- Disable overlapping amendments while a change is running; preserve the typed instruction and explain what remains safe when a run fails.
- On narrow screens, place the campaign-context navigation below the conversation and keep every destination available as a full route.
- Do not use agent avatars or conversational theater. The MotionGrid mark denotes product authorship; operational labels communicate who owns the current work.

### Empty, loading, and error states

- Empty states may use simple hand-drawn GTM motifs, but must include a concrete next action.
- Loading shows measurable campaign progress or structured skeletons, never a decorative indefinite spinner alone.
- Errors explain what failed, what remains safe, and whether MotionGrid will retry, replan, or needs the operator.
- Disconnected and reconnecting states remain visible without blocking already-loaded evidence.

## Illustration and motion

Illustration uses simple linework, pinned-paper notes, maps, routes, desk objects, and human touches. It should feel handmade and slightly imperfect around polished software frames. Do not use copied Playground artwork or generic AI-generated 3D mascots.

Motion communicates change, ownership, and causality:

- Stagger the initial hero reveal.
- Let a new target pulse once, then settle.
- Transition selection between linked map and Grid objects.
- Slide drawers with a short, controlled ease.
- Use small hover lift only on genuinely interactive marketing cards.
- Avoid bounce, constant floating, and ambient motion inside operational screens.
- Respect `prefers-reduced-motion` everywhere.

## Responsive behavior

Design mobile intentionally rather than collapsing desktop at the final breakpoint.

- Preserve the promise, CTA, capability selection, and first useful product state above the fold.
- Hide secondary navigation before shrinking its labels into illegibility.
- Convert multi-column campaign views into an explicit view switcher or a purposeful stack.
- Keep tables usable through prioritized columns, expandable rows, and horizontal scroll only when necessary.
- Maintain at least 44px touch targets for primary controls.
- Verify that no page introduces horizontal document overflow.

## Accessibility

- Meet WCAG 2.2 AA contrast for text and controls.
- Maintain visible keyboard focus.
- Pair state color with text or iconography.
- Provide equivalent non-map access to every target and action.
- Announce important campaign state changes through a restrained live region.
- Do not announce every streamed event.
- Keep semantic heading order and landmark structure.
- Use real buttons and links for interactive controls.

## Defaults to avoid

- Purple-on-white AI gradients.
- Dark sci-fi command centers as the default product shell.
- Generic dashboard card grids.
- Fake charts, fake customer data, or unexplained scores.
- Chat transcripts that replace the durable campaign artifact.
- Agent avatars and anthropomorphic bot teams.
- Glassmorphism on every surface.
- Excessive badges, floating shadows, and rounded rectangles.
- Decorative animation that competes with live campaign state.
- Copying TryPlayground brand assets, illustrations, or product-specific content.

## Implementation rule

This document is a required dependency for every user-facing UI change in `apps/web`.

Before implementation, the working agent must read this document in full and use it to choose layout, typography, color, component treatment, interaction states, responsive behavior, and accessibility. If the system needs a genuinely new pattern, add the pattern here in the same change so future screens remain consistent.

The current landing page in `apps/web/app/page.tsx` and its tokens in `apps/web/app/globals.css` are the first working reference implementation of this contract.
