# T2 · Sim World

**Wave 1 · parallel with T1, T3–T5 · ~4h · depends on T0**

Build the synthetic market and the six sim adapters that read from it. This is the data the
entire demo runs on, and it must work with the network unplugged.

## Owned paths (exclusive write)

```
src/sim/**                    generator + committed fixtures
src/adapters/sim/**           the six adapters
```

## Read-only

`src/contracts/**` — **frozen**. Escalate if a capability contract doesn't fit.

## Forbidden

`src/adapters/live/` (T7 owns it), `src/db/`, `src/mastra/`, `apps/web/app/`.

## The one hard rule

**The generator emits artifacts, never signals.** No `signal` row is ever produced here. The
agent must read the website snapshot and the reviews and derive findings itself. If you
pre-compute "this site has no booking link" into the fixture, the demo becomes a puppet show
and the product's central claim is fake.

## Deliverables

### 1. `src/sim/generate.ts` — run once, commit the output

Seed-deterministic (Faker with a fixed seed). One LLM pass for review prose and creator bios,
then **cached to JSON** — runtime never calls a model.

**60 businesses — Bengaluru, India.** Spread across Indiranagar, Koramangala, HSR Layout,
Jayanagar, Whitefield and JP Nagar. Categories that are dense and website-dependent locally:
**salons & spas, skin/derma clinics, dental clinics, boutique gyms & yoga studios, pet
clinics, speciality cafés**.

Fields: name · category · locality + geo · rating · review count · 6–10 reviews · website HTML
snapshot · 1–3 contacts (name, role, email, **+91 XXXXX XXXXX** phone)

Use realistic Indian business names and contact names. Avoid US-style naming.

Reviews must mix genuine praise with **specific operational complaints** — "booked on their
site, they had no record of it", "called 4 times on the listed number, no response", "Google
says open till 8, shutters were down at 7", "no online booking, had to DM on Instagram". These
are what the agent mines. Generic 1-star rants are useless.

Write reviews in the register Indian Google Maps reviews actually use — English, occasionally
Hinglish, often mentioning WhatsApp and Instagram as the real booking channel. That detail is
itself a qualifying signal: a business whose bookings live in Instagram DMs has a website
problem.

**Websites** templated across quality tiers, with defects genuinely present in the markup:

| Tier | Defects baked into the HTML |
|---|---|
| bad | no `<meta viewport>`, `© 2019`, no booking link, phone only inside an `<img>`, inline-styled 2000px hero |
| mid | has viewport, stale copyright, booking is a `mailto:` |
| good | responsive, current year, real booking widget |

Skew the distribution so ~60% are qualifiable — a demo where everything qualifies is as
unconvincing as one where nothing does.

**24 creators — Bengaluru beauty / wellness / lifestyle**, Instagram and YouTube:
handle · platform · followers · engagement rate · view-to-follower ratio · audience geo/age/
interest split (skewed to Bengaluru + tier-1 India) · fake-follower estimate · content
categories · brand-safety flags · past collabs · **rate card by format, in INR** ·
reachability (dm/email/agency)

Realistic INR rate cards by tier — nano ₹3,000–₹8,000, micro ₹15,000–₹40,000, mid
₹60,000–₹1,50,000 per reel. Store as integer paise with currency `INR`; format with Indian
digit grouping (₹1,50,000, not ₹150,000) in any display helper you write.

**Seed 2–3 creators with post captions that mention businesses in the target set.** T8's edge
discovery fuzzy-matches these — it's the "warm intro path" demo moment, and it only works if
you plant it. Note which ones in your handoff.

### 2. `src/adapters/sim/**` — six adapters

| Adapter | Capability | Behaviour |
|---|---|---|
| `market.geo` | `geo.query` | filter businesses by category + geo radius, return N |
| `index.db` | `db.query` | filter creators (or companies) by typed predicate |
| `market.web` | `web.fetch` | return the stored HTML snapshot for a target |
| `market.reviews` | `reviews.fetch` | return reviews, **lowest-rating first** (surfaces pain) |
| `market.people` | `people.find` | return stored contacts with a confidence score |
| `cohort.segment` | `segment.build` | synthesize a segment with size + statistical attributes |

Each declares its **shadow unit cost** matching real vendor rates so T3's estimate reflects
production: `geo.query` $0.003/record, `people.find` $0.011/record, `db.query` $0.002/record.

Add a small artificial latency (50–150ms) so the Grid streams at watchable pace rather than
completing instantly.

## The seven engineering rules

1. One source of truth for types — `src/contracts/`.
2. Parse at the edge — **fixture load is a parse boundary**: `Schema.parse(json)` once at
   load, then trust the type everywhere.
3. **Zero `as`. Zero `any`.**
4. try/catch only in: a `.parallel()`/`.foreach()` step, a live-adapter network call, an API
   route handler. **Sim adapters do no network I/O — so no try/catch here.**
5. Errors are values inside the pipeline.
6. No defensive optional chaining.
7. **Adapters are pure w.r.t. their contract** — same input, same output, no global state.

## Done when

- [ ] `pnpm sim:generate` is deterministic — same seed, byte-identical fixtures
- [ ] Fixtures committed to the repo
- [ ] Every adapter's output parses against its capability contract in a test
- [ ] No `signal` data anywhere in the fixtures
- [ ] Seeded creator↔business mentions documented in the handoff
- [ ] Adapters work with the network disabled
- [ ] Handoff note written

---

## Handoff note

Built the seed-deterministic offline world in `src/sim/fixtures/world.json`: 60 Bengaluru
businesses, 24 creators, stored HTML/review/contact artifacts, creator audience and safety
attributes, and INR rate cards in integer paise. The generator uses seed `20260808`; two
consecutive runs produced SHA-256
`091831ec35f3ab3f72201ddfa62ff592026cc57750d56fe9cb9b5c499a40c0cc`. Prose is cached in
the committed fixture and neither generation nor runtime requires a model or network call.

Website-quality split: **36 qualifiable / 24 not qualifiable** (24 bad, 12 mid, 24 good).
This is an artifact-level fixture classification for demo balancing only; it is not stored as
a finding on any business. No signal rows or precomputed findings are present.

Planted creator mentions for T8 fuzzy matching:

- `creator-03` — Amulya Gowda (`@amulyagowda`) mentions `business-01`, Aarohi Salon & Spa.
- `creator-12` — Kavya Murthy (`@kavyamurthy`) mentions `business-11`, Tvacha Skin Clinic.
- `creator-20` — Sahana Prasad (`@sahanaprasad`) mentions `business-33`, Prana Courtyard.

The six adapters live in `src/adapters/sim/`, add deterministic 50–150 ms latency, and have
contract-parsing coverage in `adapters.test.ts`. Shadow operating costs are 0.3 cents per geo
record, 0.2 cents per database record, and 1.1 cents per people record; all are projected and
carry zero commit cost.
