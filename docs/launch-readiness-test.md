# Havlo launch-readiness test

Final QA pass before launch. Run against the live deployment at
`https://havlo.io`. The two primary markets are **NG** (`/ng`) and
**UK** (`/uk`); call out anything that breaks specifically in one
of those, since other countries (US / DE / AE / IN / ZA) are
secondary at launch.

Priority key:
- **P0** → cannot ship; fix before pushing the launch button
- **P1** → should not ship; fix or document the workaround
- **P2** → nice to clean; fine to land within the first week

If you only have time for one pass, run all P0 blocks (A–E) in
order. If one fails, stop and flag — don't move on to P1.

---

## Block A · NG homepage end-to-end (P0)

The primary surface for the primary market. Single most expensive
regression here would be the recent NG-local bucket fix not
holding under load.

### A1. `/ng` first impression (cold load)
- [ ] Open `https://havlo.io/ng` in an incognito window
- [ ] Hero H1 reads cleanly on mobile — large editorial type, two
      clauses ("Before you buy it," / "find it for less.") stacking
      on separate lines without orphans
- [ ] Search input is the dominant action on first viewport
- [ ] No `Application error: a server-side exception has occurred`
      (we hit this during the popularity rollout; should be fixed)

### A2. Trending grid composition (NG-local must be visible)
On the "Trending right now" grid (16 cards), count card origins:
- [ ] **At least 8 of 16** are NG retailers (Konga, 3C Hub,
      HealthPlus, Supermart, Essenza, MedPlus, Slot, Jumia)
- [ ] Roughly 4 Amazon-family cards
- [ ] Roughly 1 AliExpress card
- [ ] Roughly 2 cross-border cards (Currys / Best Buy / John Lewis /
      Argos / ASOS / Macy's …)
- [ ] Refresh the page — proportions should hold within ±2 across
      the rotation window

### A3. Category tile counts match `/deals?category=X`
Click each tile on `/ng` and verify the deal count on the resulting
`/ng/deals?category=X` page matches what the tile said.
- [ ] phones
- [ ] beauty
- [ ] fashion
- [ ] electronics
- [ ] All 10 browsable categories

Numbers should be **exactly equal**. If any diverge, flag the tile.

### A4. Cashback teaser section
- [ ] Section visible between "Trending right now" and "Deals by
      category"
- [ ] Eyebrow: "Cashback · next up"
- [ ] Headline: "Money back on the deals you'd buy anyway."
- [ ] Body mentions specific rates ("5% at AliExpress, 2% at
      Amazon today")
- [ ] Rate pills show Amazon variants + AliExpress with correct %
- [ ] Email form submits successfully — enter a real email + click
      "Join the waitlist"; confirm a success state "You're on the
      list." appears

### A5. Brand voice check on `/ng`
Read the homepage top-to-bottom looking for any of these AI-tells:
- [ ] No em-dashes anywhere (—)
- [ ] No "Coming soon" outside the cashback context
- [ ] No "Get paid to shop" / "Earn up to X%" marketing-page
      template phrases
- [ ] No "No app, no points, no expiry" type three-part negative
      lists
- [ ] No "the moment X launches" preciousness

---

## Block B · UK homepage end-to-end (P0)

### B1. `/uk` first impression
- [ ] Hero loads, prices display in **£** (not ₦ or $)
- [ ] Subhead caption mentions UK or feels country-aware
- [ ] Cashback teaser shows the same rate pills as NG (they're
      global rates, not country-specific yet)

### B2. Trending grid mix
- [ ] UK retailers visible (Argos, Currys, John Lewis, ASOS,
      Boots, AO.com, …)
- [ ] **No Konga / Jumia / 3C Hub cards** — those are NG-only
      retailers and should be filtered out
- [ ] Amazon UK cards present (Amazon.co.uk variants)
- [ ] AliExpress / Shein / Temu allowed
- [ ] **No US-only retailers** (Walmart US, Best Buy US, Macy's)
      unless they're explicitly on the UK cross-border allowlist

### B3. INTL badge logic
- [ ] UK retailer cards (Argos, Currys, …) do **not** have an
      "INTL" badge
- [ ] AliExpress / Shein cards **do** show "INTL"
- [ ] Toggle to list view (mobile only) — INTL badge should appear
      bottom-left of the thumbnail on cross-border cards in list
      view too

### B4. Currency display on UK
- [ ] All prices show £ symbol
- [ ] No "≈ ₦…" approximations on `/uk` pages
- [ ] Cross-border cards may show a secondary "$X.YZ" hint (the
      merchant's native USD) — this is correct
- [ ] Landed-cost estimates (when shown) are in £, not ₦

---

## Block C · Search + compare flow (P0)

### C1. Text search from `/ng`
- [ ] Type "iPhone 15 Pro" in the hero search → lands on
      `/ng/compare?q=iPhone+15+Pro`
- [ ] Anchor card shows a real product image + title + price
- [ ] At least 2 store rows render under "Across N stores"
- [ ] Each row's `View at <store>` click opens the merchant in a
      new tab (does NOT bounce back to Havlo)

### C2. URL paste flow
- [ ] Copy any product URL from Amazon / Konga / AliExpress
- [ ] Paste into the search box → page shows "Analysing link…"
      then a sniffed product card + alternatives
- [ ] The cashback chip (if the URL is from a cashback-eligible
      store) shows "Earn 2% cashback on this through Havlo (coming
      soon)" and links to `/ng/cashback`

### C3. Single-store edge case
- [ ] Search a niche product likely to have only 1 store (e.g.
      "Stainless Steel Colored Handi Set")
- [ ] Anchor card renders with a clickable single store row
- [ ] Header reads **"Available at"** (not "Across 1 store")
- [ ] No green/success border on the single row, no star icon, no
      "Sorted cheapest first" caption

### C4. Popular comparisons chip rail
- [ ] Empty-state `/ng/compare` shows the chip rail above the
      results area
- [ ] Mobile: chips horizontally scroll (single row), do NOT wrap
      into a ragged 3-4 row stack
- [ ] Desktop: chips wrap naturally across the width
- [ ] Most visible chips have a store-count badge ≥ 2
- [ ] Wait 5 seconds — chips rotate; multi-store chips stay
      stable, only the backfill positions shuffle
- [ ] No chip starts with a quantity prefix ("10 Pcs", "Set of 4")

### C5. Clear-and-restart
- [ ] Run a search, results show
- [ ] Click the X to clear the input
- [ ] The chip rail reappears with no query

---

## Block D · Click-through hygiene (P0)

Every outbound click must land on a real merchant page. **Never**
bounce to:
- `havlo.io/?deal_unavailable=1`
- `consent.google.com`
- A blank tab
- A 404

### D1. Direct merchant URLs
- [ ] On `/ng`, click 5 random cards in a row. Each opens the
      merchant's product page in a new tab.

### D2. UK retailer click-through
- [ ] On `/uk/deals`, click 5 UK retailer cards (Argos, Currys,
      JL, Boots, AO). Each lands on the merchant's product page
      OR the merchant's search results for the product title.

### D3. Google-relay fallback
- [ ] Inspect a card's link — if the URL on hover contains
      `/api/go?url=https://www.google.com/...`, click it
- [ ] Expected: SerpAPI resolver finds the merchant, OR falls
      through to the merchant's own search URL via store hints
- [ ] Should never land on consent.google.com with a 400

### D4. AliExpress affiliate
- [ ] Click any AliExpress card
- [ ] Final URL should contain `s.click.aliexpress.com` (the
      affiliate tracking link), confirming the ALIEXPRESS API
      converter ran

### D5. Amazon affiliate
- [ ] Click any Amazon card
- [ ] Final URL should contain `?tag=...` (the Amazon affiliate
      tag from `AMAZON_ASSOC_TAG_*` env)

---

## Block E · Brand content consistency (P0)

### E1. Voice across every page

Walk through these pages and read the copy with the brand-voice
rules in mind (founder-led, plain English, no em-dashes, no
marketing fluff, concrete numbers, honest tradeoffs):

- [ ] `/ng` homepage
- [ ] `/ng/deals`
- [ ] `/ng/compare` (empty + with results)
- [ ] `/ng/cashback`
- [ ] `/ng/blog` + one article
- [ ] `/how-we-make-money`
- [ ] `/contact`
- [ ] `/privacy-policy`
- [ ] `/terms-of-use`

Flag any line that triggers one of:
- "Earn up to X%…" template
- "Coming soon" outside cashback context
- "No app / no points / no expiry" three-part lists
- "Plain cash, paid to your bank or wallet once you hit the
   withdrawal minimum"-style fine-print mechanic in a hero/teaser
- Em-dashes (—)

### E2. Cross-page rate consistency
- [ ] `/ng` cashback teaser shows the same rates as `/ng/cashback`
- [ ] Footer-level claims (if any) match
- [ ] OG share images don't claim "5% on everything" — should
      reflect actual rate map

### E3. Country in copy
- [ ] `/ng` metadata title/description mention Nigeria
- [ ] `/uk` metadata mention United Kingdom
- [ ] `/de` metadata mention Germany
- [ ] Page H1s and headlines stay country-appropriate

### E4. Country switcher
- [ ] Open the country switcher (top-right of nav)
- [ ] List is **alphabetical** (Germany, India, Nigeria, …)
- [ ] Each country has its flag emoji
- [ ] Clicking a country navigates to that country's homepage
      AND sets the cookie so subsequent visits remember the choice

---

## Block F · Metadata + SEO (P1)

### F1. Per-page metadata
For each of these URLs, inspect the page source (or use a SEO
inspector tool) and confirm:

- `<title>` 50–60 chars, unique per page, includes "Havlo"
- `<meta name="description">` 150–160 chars
- `<link rel="canonical">` points at the absolute URL
- `og:title`, `og:description`, `og:image`, `og:url` present
- `twitter:card`, `twitter:image` present

URLs to check:
- [ ] `/ng`
- [ ] `/uk`
- [ ] `/ng/deals`
- [ ] `/ng/compare?q=iPhone+15+Pro`
- [ ] `/ng/cashback`
- [ ] `/how-we-make-money`

### F2. Hreflang alternates
- [ ] View source of `/ng/cashback` — should have `<link rel="alternate" hreflang="…">` entries for every country variant
      (ng, uk, us, de, ae, in, za)
- [ ] Same on `/ng/deals` and `/ng/compare`

### F3. Sitemap + robots
- [ ] `https://havlo.io/sitemap.xml` loads, contains every country's
      core pages
- [ ] `https://havlo.io/robots.txt` loads, references the sitemap,
      doesn't disallow anything important

### F4. Structured data
- [ ] `/ng` has a `BreadcrumbList` JSON-LD
- [ ] `/ng/blog/*` articles have `Article` JSON-LD
- [ ] Pass each through Google's Rich Results Test — no errors

### F5. Indexability
- [ ] `/ng` returns `200`, not `noindex`
- [ ] `/_next/*` paths still blocked from crawlers (default Next behaviour)

---

## Block G · Performance + Core Web Vitals (P1)

Use Chrome DevTools Lighthouse on mobile emulation (Slow 4G,
4× CPU slowdown). Run from a clean profile.

Targets per page:
- LCP < 2.5s
- CLS < 0.1
- INP < 200ms
- Lighthouse mobile performance score ≥ 80

Pages to test:
- [ ] `/ng`
- [ ] `/uk`
- [ ] `/ng/deals`
- [ ] `/ng/compare?q=iPhone+15+Pro`
- [ ] `/ng/cashback`

Specifically check:
- [ ] Hero image (LCP candidate) — eager loaded, no layout shift
- [ ] Trending grid images — lazy loaded, dimensions reserved
- [ ] No console errors on any page

---

## Block H · Mobile UX deep dive (P1)

Use a real iPhone or Android (or Chrome devtools at 390×844).

### H1. Hero on mobile
- [ ] H1 wraps to 2 lines clean ("Before you buy it," / "find it
      for less.")
- [ ] Search input has 16px font (no iOS auto-zoom on focus)
- [ ] Category pills (under search) scroll horizontally
- [ ] Search button shows arrow-only icon (no "Search" label
      eating width)

### H2. Trending grid on mobile
- [ ] 2-column masonry layout
- [ ] Cards have correct aspect (varied per masonry pattern)
- [ ] Discount badge top-right of image visible
- [ ] INTL badge bottom-left of cross-border cards visible
- [ ] Cashback badge bottom-right (when applicable) visible

### H3. /deals on mobile
- [ ] View-mode toggle (grid / list) visible above the grid
- [ ] Toggling to list view works; preference persists across
      reloads (localStorage)
- [ ] List card thumbnails show INTL badge on cross-border deals

### H4. /compare on mobile
- [ ] Search bar full-width
- [ ] Popular comparisons chips swipe horizontally (single row),
      do NOT stack into multiple rows
- [ ] Anchor card on a results page is full-width, readable
- [ ] Store rows under "Across N stores" are full-width, tappable

### H5. Nav drawer on mobile
- [ ] Hamburger opens a drawer with all primary links
- [ ] Cashback, Deals, Blog, About all present
- [ ] Country switcher accessible from the drawer

---

## Block I · Email + waitlist flows (P1)

### I1. Newsletter signup
- [ ] On `/ng`, scroll to "Stay in the loop" section
- [ ] Enter a real email, click submit
- [ ] Success state appears
- [ ] Check inbox — welcome email arrives within 30s, has Havlo
      branding, includes unsubscribe link

### I2. Cashback waitlist signup
- [ ] On `/ng/cashback`, enter email + submit
- [ ] Success state: "You're on the list."
- [ ] Inbox: confirmation email arrives, founder-voice tone, no
      "thanks for joining our community!" type filler

### I3. Homepage cashback teaser signup
- [ ] On `/ng`, scroll to the cashback teaser section
- [ ] Enter a DIFFERENT email + submit
- [ ] Success state: "You're on the list. We'll email you when it
      goes live."
- [ ] Verify in Supabase that the row has `source =
      "homepage-cashback"` (vs "cashback-page" for the dedicated
      page signups)

### I4. Duplicate handling
- [ ] Submit the same email twice from the same source
- [ ] Both times return success (no error shown to user)
- [ ] Only one row in `cashback_waitlist` for that (email, source) pair

---

## Block J · Affiliate + monetization (P1)

### J1. Amazon associate tags
- [ ] Click an Amazon US card → final URL has
      `?tag=<AMAZON_ASSOC_TAG_US>`
- [ ] Click an Amazon UK card → final URL has
      `?tag=<AMAZON_ASSOC_TAG_UK>`
- [ ] Repeat for DE / AE / IN if applicable

### J2. AliExpress conversion
- [ ] Click an AliExpress card → final URL host is
      `s.click.aliexpress.com`
- [ ] Confirm `ALIEXPRESS_APP_KEY` / `ALIEXPRESS_APP_SECRET` env
      vars are set in Vercel production

### J3. Konga affiliate
- [ ] Click any Konga card → final URL has a Konga affiliate
      param wrapped

### J4. SerpAPI quota
- [ ] Check the SerpAPI dashboard for current month usage
- [ ] Should be < 80% of monthly quota; if higher, kill switch
      `SERPAPI_DISABLED=true` is documented as available

### J5. Click telemetry
- [ ] Click any deal card
- [ ] Wait 60s
- [ ] Run `npx tsx --tsconfig tsconfig.scripts.json scripts/verify-popularity.ts`
- [ ] Should report ✓ on all 5 steps — confirms migration 0015 is
      applied and the popularity pipeline picks up real clicks

---

## Block K · Legal + compliance (P1)

### K1. Required pages
- [ ] `/privacy-policy` loads, mentions cookies, GDPR, contact
- [ ] `/terms-of-use` loads, mentions affiliate disclosures
- [ ] `/how-we-make-money` loads, explains the commission model
      plainly
- [ ] `/contact` has a working form (or mailto fallback)

### K2. Affiliate disclosure
- [ ] Bottom of `/ng/compare?q=X` results shows the affiliate
      disclosure line ("Some links earn Havlo a commission…")

### K3. Cookie banner (UK / EU)
- [ ] On a first visit to `/uk`, a cookie banner appears
- [ ] User can decline, accept, or customize
- [ ] Declining doesn't break the site
- [ ] Choice persists in cookie / localStorage

### K4. GDPR-specific
- [ ] No third-party tracking scripts fire before consent
- [ ] User can request data deletion via the contact form
- [ ] Privacy policy includes a data-controller address

---

## Block L · Error + empty states (P2)

### L1. Empty searches
- [ ] Search a clearly fake product ("zzzzzzzz nonsense product")
- [ ] Page shows "Nothing in our local index for X yet" with
      either a live-results fallback OR helpful next steps
- [ ] Never a raw 500 or a blank page

### L2. Network failure recovery
- [ ] Open DevTools, set Network → Offline
- [ ] Try to submit the cashback waitlist form
- [ ] User sees a clear "Couldn't reach the server" message
      (specific enough to debug from)

### L3. 404 page
- [ ] Visit `https://havlo.io/this-does-not-exist`
- [ ] Lands on a 404 page with navigation back to home

### L4. Stale URL params
- [ ] `/ng/deals?sort=popular` → loads (now real, post-migration-0015)
- [ ] `/ng/deals?sort=junk-value` → falls back to relevance silently
- [ ] `/ng/compare?key=garbage` → empty state, not a 500

---

## Block M · Cross-browser + device (P2)

Spot-check on:
- [ ] Safari iOS (latest)
- [ ] Chrome Android (latest)
- [ ] Safari macOS (latest)
- [ ] Chrome desktop (latest)
- [ ] Firefox desktop (latest)
- [ ] Edge desktop (latest)

For each, run a quick:
1. Load `/ng` — renders cleanly?
2. Run a search — works?
3. Click a card — opens correctly?

If anything breaks on Safari iOS specifically, prioritize — that's
a huge slice of mobile traffic.

---

## Block N · Operational readiness (P1)

### N1. Cron jobs
- [ ] Inspect `.github/workflows/scrape-deals.yml`
- [ ] Last run timestamp on GitHub Actions is recent
- [ ] No failed jobs in the last 3 cron cycles

### N2. Data freshness
- [ ] On `/ng/deals`, the "Latest" sort shows deals scraped within
      the last 4 days
- [ ] Konga / 3C Hub / Jumia all represented in the past 7 days

### N3. Vercel env vars
Confirm in Vercel dashboard:
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SERPAPI_KEY` (or `SERPAPI_DISABLED=true` if intentionally off)
- [ ] `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`,
      `ALIEXPRESS_TRACKING_ID`
- [ ] `AMAZON_ASSOC_TAG_US`, `AMAZON_ASSOC_TAG_UK`, etc.
- [ ] `RESEND_API_KEY` (transactional emails)

### N4. Supabase migrations applied
- [ ] Connect to Supabase SQL editor
- [ ] Run: `select tablename from pg_tables where schemaname='public' order by tablename;`
- [ ] Should include: `products`, `offers`, `stores`,
      `outbound_clicks` (0015), `cashback_waitlist` (0006),
      `newsletter_subscribers` (0009), `resolved_clicks` (0005)
- [ ] Run: `select proname from pg_proc where pronamespace = 'public'::regnamespace;`
- [ ] Should include: `popular_products`, `search_products_fts`,
      `suggest_titles`, `suggest_multistore_products`

### N5. Monitoring
- [ ] Vercel deployment logs reviewed for the last week — any
      recurring errors (not just one-offs)?
- [ ] Supabase logs reviewed — any auth errors, slow queries?
- [ ] Sentry / equivalent error tracker configured (optional but
      recommended for launch)

---

## Reporting format

For each block, mark one of:
- **PASS** ✓ — every item passed
- **PASS-with-notes** — passed but minor observations to flag
- **FAIL** ✗ — at least one item failed (specify which)
- **NOT-TESTED** — skipped (and why)

Top of report should answer two questions clearly:
1. **Are NG and UK shippable today?** (yes / no / yes-after-fixing-X)
2. **What's the single biggest risk if we shipped right now?**

Followed by:
- **P0 blockers**: every P0 fail listed with severity + repro
- **P1 issues**: same, ranked
- **P2 polish**: same, no severity needed
- **Positive surprises**: things that worked better than expected

---

## Reference: recently shipped (verify these specifically)

- NG homepage bucket rebalance (55% local + 25% Amazon + 6%
  AliExpress + 12% intl-other) — `Block A2`
- Compare single-store row rendering — `Block C3`
- Popular comparisons chip rail prioritisation + mobile horizontal
  scroll — `Block C4`, `Block H4`
- "Most popular" sort wired to real click telemetry via
  `outbound_clicks` + `popular_products` RPC — `Block J5`
- Category tile counts aligned with `/deals` totals — `Block A3`
- Cashback teaser section with founder voice — `Block A4`, `Block E1`
- INTL badge on list view — `Block B3`, `Block H3`
- Hero H1 sizing restored to `clamp(1.95rem, 8vw, 5rem)` — `Block A1`,
  `Block H1`
