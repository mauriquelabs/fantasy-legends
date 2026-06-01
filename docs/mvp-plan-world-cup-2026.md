# MVP Plan — World Cup 2026 Pilot

> **Deadline: June 11, 2026** (World Cup kickoff — 10 days from June 1)

---

## Gap Analysis: 4 Pillars vs. Current State

### Pillar 1 — Competition Hub (~75% done)
- ✅ Fixtures page
- ✅ Squads/rosters per team
- ❌ Home page / competition landing (`/world-cup` is a stub)
- ❌ Tournament bracket / knockout visualization

### Pillar 2 — Player Status & Context Layer (~30% done)
- ✅ Sorare scores + form sparklines
- ✅ Pagination + position/team filters
- ❌ Starter probability / rotation risk / injury signals (no data source wired)
- ❌ Competition-specific dynamics

### Pillar 3 — Sorare Card Integration (~15% done)
- ✅ Player `sorareSlug` stored in DB
- ❌ Card availability visibility, scarcity indicators
- ❌ Marketplace shortcuts (beyond raw deeplinks)

### Pillar 4 — Gameplay Foundations (0% done)
- ❌ Auctions + deals (stubs exist, no backend)
- ❌ User accounts / saved state
- ❌ Game modes / community leagues

---

## Prioritized Tasks

### P0 — Must ship before June 11

| # | Task | Effort |
|---|------|--------|
| 1 | **Competition Hub home page** — group draw overview, key dates, nav to Squads/Fixtures/Players | 1 day |
| 2 | **Player availability badges** — Available / Doubtful / Out status on each player card. Use football-data.org if data is available; fall back to a manual-flag DB column | 1–2 days |
| 3 | **Sorare marketplace deeplinks** — "View on Sorare" link on every player row/dialog using `sorareSlug` | 2 hours |
| 4 | **Founding Member pass + Stripe integration** — Full backend integration from day one (see below) | 1 day |

### P1 — Ship during Week 1–2 of the tournament

| # | Task | Effort |
|---|------|--------|
| 4 | **Score freshness indicator** — "Last synced X min ago" on the players page using existing `scoresUpdatedAt` column | 0.5 days |
| 5 | **Group standings table** — Derive from fixture results already being fetched | 1 day |
| 6 | **Frontend smoke tests** — Critical paths for Players, Fixtures, and Squads pages (currently zero frontend tests) | 1 day |

### P2 — Defer post-WC or cut

- Auctions / deals pages (no backend, no data source)
- User authentication + saved lineups
- Community game modes
- Additional sports beyond football

---

## Founding Member Pass — Monetization Approach

### Model
- **Everything free** — no feature gating. The pass is a support pledge + priority access to future gameplay features.
- **Price: €9 or €10** (impulse-buy territory, season pass framing)
- **No auth required** for the WC pilot — auth is a post-WC milestone

### What paying gets you (now)
- Founding member status
- Priority access to premium gameplay features when they ship
- Direct line to shape the product

### Pitch framing
*"World Cup 2026 is the pilot. Help us build the future of Sorare gameplay — founding members get priority access to everything we build next."*

### Technical implementation

**Backend (Stripe — full integration from day one):**
- `POST /api/payments/checkout` — creates a Stripe Checkout session, returns redirect URL
- `POST /api/payments/webhook` — receives `checkout.session.completed` from Stripe, writes to DB. Must verify Stripe signature before trusting payload (`STRIPE_WEBHOOK_SECRET` in `.env`).
- New `purchases` table — `(id, email, stripeSessionId, amount, currency, createdAt)`

**Frontend:**
- "Become a Founding Member" CTA on the home page
- Clicking → calls checkout endpoint → redirects to Stripe-hosted checkout
- `/thank-you` page for post-payment redirect (Stripe `success_url`)

**Why full Stripe backend from day one (not just a Payment Link):**
Skipping the webhook creates debt — Stripe exports would need to be reconciled with the DB later, and email-to-account matching becomes messy when auth ships. Recording `(email, stripeSessionId, amount)` in the DB from the first sale costs ~half a day and avoids all of that.

**New env vars needed:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`

---

## Technical Concerns

1. **Port inconsistency** — Memory/docs say API runs on port 3001 but `replit.md` shows 5000. Verify and document the canonical port to avoid local dev confusion.

2. **No CLAUDE.md content** — File exists as a template but is empty. A brief architecture summary would save onboarding time for contributors.

3. **Supabase pooler requirement** — This machine is IPv4-only; must use the pooler URL (`aws-1-*.pooler.supabase.com`), never the direct `db.*.supabase.co` host. Document this in the repo, not just as a local `.env` assumption.

4. **football-data.org rate limits** — Fixtures are cached at 5 min TTL. If availability/injury data is pulled from the same API, ensure caching is consistent and the rate limit budget is understood before adding new endpoints.

---

## Recommended Timeline (June 1–10)

| Day | Task |
|-----|------|
| Day 1 | Build home page shell — group draw, key dates, links to the three main views |
| Day 2 | Stripe integration — `purchases` table migration, checkout + webhook endpoints, thank-you page |
| Day 2–3 | Player availability badges — DB column + API field + UI badge |
| Day 3 | Sorare marketplace deeplinks on player rows/dialogs |
| Day 4 | Group standings derived from fixture data |
| Day 5 | Score freshness indicator + general polish pass |
| Day 6–7 | Frontend smoke tests + E2E happy path for each page |
| Day 8–10 | Buffer for WC-week data issues, API surprises, and early user feedback |

---

## What's Deliberately Out of Scope

Pillar 3 (Card Integration beyond deeplinks) and Pillar 4 (Gameplay) each require Sorare API access patterns not yet wired and would take 1–2 weeks individually. Both are deferred. This is consistent with the product doc's stated intent: *"The MVP intentionally avoids unnecessary complexity. The goal is validation, not feature breadth."*
