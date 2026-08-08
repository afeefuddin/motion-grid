<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MotionGrid design contract

`../../docs/DESIGN.md` is the source of truth for MotionGrid's visual language and interaction design.

Before creating, changing, reviewing, or polishing any user-facing UI in `apps/web`, you **must read `docs/DESIGN.md` in full and explicitly use it as a constraint for the work**. This includes pages, layouts, components, loading and empty states, responsive behavior, interaction states, and data visualizations. Do not begin UI implementation from memory or from generic framework defaults.

If a requested UI change conflicts with the design document, preserve the user's explicit request and update the design document in the same change so the code and design contract do not drift. New visual patterns should be added only when the existing system cannot express the product need.
