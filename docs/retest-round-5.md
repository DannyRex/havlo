# Havlo retest — round 5

Scope: regressions + new fixes shipped in this session. Test against
the live deployment at `https://havlo.io` (not staging). All NG-
specific checks use `/ng`; cross-country checks call out the path.

If you only have time for one pass, run **Block A** end-to-end —
that's where regressions would hurt most.

---

## Block A — NG homepage composition (P0)

We discovered the NG homepage's "local" bucket had been ~86% intl
retailers (Best Buy, Currys, ASOS, John Lewis, Macy's, …) and only
~14% actual NG retailers, because `classifyDeal` treats anything-not-
Amazon-not-AliExpress as "local". For non-NG that's correct; for NG
it crowded Konga / 3C Hub / Essenza out of the local quota.

New target mix per 16-card grid:
- **55% local** (9 slots) — Konga, 3C Hub, HealthPlus, Supermart,
  Essenza, MedPlus, Slot, Jumia
- **30% monetised** (4 Amazon + 1 AliExpress)
- **~12.5% intl-other** (2 slots) — Currys, Best Buy, John Lewis,
  Argos, ASOS, etc.

### A1. Visit `https://havlo.io/ng` and count
- [ ] Across the "Trending right now" grid (16 cards), at least
      **8 of 16** should be NG retailers (Konga, 3C Hub, HealthPlus,
      Supermart, Essenza, MedPlus, Slot, Jumia). 9 is the target;
      8 is acceptable if a bucket was thin and backfill kicked in.
- [ ] At least **2 of 16** should be cross-border retailers (Currys,
      Best Buy, John Lewis, Macy's, Argos, ASOS, …). Confirms the
      `intl-other` bucket survived as a separate quota — not dropped.
- [ ] Amazon-marketplace cards should total **~4** (any mix of
      `amazon.com / amazon.co.uk / amazon.de / amazon.ae / amazon.in`).
- [ ] AliExpress cards should be **~1**.
- [ ] **Fail if**: 0 NG retailers visible. That's the bug being
      re-tested.

### A2. Hard refresh + recount
- [ ] Reload the page (Cmd+Shift+R). The pool rotates on a 5-min
      bucket so the same picks may persist. Then wait 5 min and
      reload — the proportions should shift but the **~55% local
      share should hold**.

### A3. Visit `https://havlo.io/uk` and confirm non-NG path unchanged
- [ ] UK retailers (Argos, Currys, John Lewis, ASOS, Boots, …) and
      Amazon UK should dominate. No leak from the NG-only intl-other
      separation.

---

## Block B — Compare single-store rendering (P1)

Bug: when a `/compare` anchor product only had 1 offer, the entire
offer-row section was hidden behind an `offers.length > 1` gate. The
user saw a product card but no way to click through to the merchant.

### B1. Search a single-store product
- [ ] Go to `https://havlo.io/ng/compare`
- [ ] Search "Stainless Steel Colored Handi Set" (or any niche
      product likely to have 1 offer)
- [ ] The anchor card should now render:
      - Header copy: **"Available at"** (not "Across 1 store")
      - A single clickable row with the store logo + name + price + chevron
      - **No** green/success border, **no** star icon, **no**
        "Sorted cheapest first" caption — those imply a comparison
        that doesn't exist
- [ ] Clicking the row should redirect through `/api/go` to the merchant
- [ ] **Fail if**: the anchor card has no clickable store row.

### B2. Multi-store should still look like a comparison
- [ ] Search "iPhone 17 Pro" (or any product with 2+ stores)
- [ ] The cheapest row should have the green border + star icon
- [ ] Header should read **"Across N stores"** with **"Sorted
      cheapest first"** on the right
- [ ] Other rows should show the `+₦X` price gap from cheapest

---

## Block C — Popular comparisons chip rail (P1)

Bug: the rail did a uniform random pick across the entire pool, so
1-store chips appeared as often as multi-store ones. Multi-store
chips are the rail's whole value prop.

### C1. /compare empty state
- [ ] Go to `https://havlo.io/ng/compare` (don't search anything yet)
- [ ] "Popular comparisons" rail should be visible
- [ ] **Most chips should show a store count badge ≥ 2** (the small
      number on the right of each chip)
- [ ] 1-store chips should only appear as backfill — at most 2-3 of
      10 visible chips
- [ ] Wait 5 seconds — chips rotate. The multi-store leaders should
      persist; only the backfill positions should swap

### C2. Diversity check
- [ ] Across 2-3 rotation cycles, you should see chips from at least
      4 different categories (not all phones/audio). Beauty, fashion,
      home, sports, etc. should appear via the thin-category top-up

### C3. Junk filter
- [ ] **Fail if**: any chip starts with a quantity ("10 Pcs", "5 Pack",
      "Set of 4", "3 in 1 Pack"). Those should be filtered upstream.

---

## Block D — "Most popular" sort on /deals (P1)

Restored after audit found it was a no-op (DB pre-sort fell back to
`scraped_at`, JS post-sort sorted by hardcoded `clicks: 0`). Now
backed by real click telemetry via `outbound_clicks` +
`popular_products()` RPC over a 30-day window.

### D1. Sort dropdown
- [ ] Go to `https://havlo.io/ng/deals`
- [ ] Open the sort selector — "Most popular" should be present
      between "Top discount" and "Price: low → high"

### D2. Functional behaviour (sparse-data acceptable)
- [ ] Select "Most popular"
- [ ] Order should NOT be identical to "Latest" (the prior broken
      state). It should be similar to "Top discount" by default
      (tiebreaker is `discountPercent` when most products tie at 0
      clicks)
- [ ] As clicks accumulate over the coming days, the order should
      diverge from pure discount-desc

### D3. URL persistence
- [ ] After selecting "Most popular", reload the page — the dropdown
      should still show "Most popular" (read from `?sort=popular` URL param)
- [ ] Try a junk URL like `?sort=junk` — should silently fall back
      to "Relevance" via the VALID_SORTS guard, no 500

### D4. Click telemetry round-trip (optional, ops-y)
- [ ] Click any deal card on `/ng/deals`. Wait 60s for the click to
      land in `outbound_clicks` and propagate through the 5-min cache
- [ ] Run `npx tsx --tsconfig tsconfig.scripts.json scripts/verify-popularity.ts`
      from the project root — should report ✓ on all steps

---

## Block E — Merchant fallback chain (regression check)

Prior round shipped a multi-step fallback chain so `/api/go` never
strands users on a Havlo error page. Re-verify nothing regressed.

### E1. Cross-border card click
- [ ] On `/ng` or `/ng/deals`, click any Currys / Argos / Best Buy
      / John Lewis / ASOS card
- [ ] Should land on the actual merchant — either the specific
      product page, or the merchant's search results for the product
      title. **Never** on `havlo.io/?deal_unavailable=1` or
      `google.com`.

### E2. Unresolvable Google relay
- [ ] If you spot a card whose URL on hover shows
      `/api/go?url=https://www.google.com/...`, click it
- [ ] Expected: SerpAPI resolves it (cached for 30 days), OR falls
      through to the merchant's own search URL via the store hint.
- [ ] **Fail if**: lands on `consent.google.com` with a 400.

---

## Block F — Cashback page copy (smoke test)

Pre-launch waitlist page. Should read as founder-voice, no em-dashes,
honest about the "coming soon" Phase 2 framing.

### F1. /cashback hero + sections
- [ ] Go to `https://havlo.io/ng/cashback`
- [ ] Verify:
      - Eyebrow: "Cashback · Coming Soon"
      - H1 reads naturally, no marketing fluff
      - "How it works" 4-step list is clear
      - Trust cards: "No hidden fees" + "No bias on results"
      - Waitlist email signup actually submits (no JS errors in
        console)
      - FAQ section answers feel concrete, not aspirational
- [ ] **No em-dashes anywhere** (they read AI-generated and the
      brand voice explicitly excludes them)

---

## Block G — Mobile (any iPhone-class viewport)

### G1. Hero H1 on mobile
- [ ] On `https://havlo.io/ng` mobile width: the H1 should wrap
      cleanly — no orphan word on its own line, no clipping
- [ ] Search button visible (icon-only on mobile is acceptable;
      "Search" text label on tablet+)

### G2. /compare on mobile
- [ ] Searching shows results without horizontal scroll
- [ ] Single-store row (Block B1) is full-width and tappable

---

## Reporting format

For each block, mark:
- **PASS** — works as described
- **FAIL** — specific bug (include URL, steps, screenshot if possible)
- **PARTIAL** — works but with a caveat (describe)

Top of report should answer one question: **Are the NG-local cards
back on /ng?** That's the primary regression being verified.
