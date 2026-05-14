# Click Resolver Audit — Agent Prompt

Paste the section below into Claude (or any browser-capable AI agent) to
run a fresh audit of Havlo's outbound click resolver. The agent will
test live PDPs, record where each click actually lands, and report back
in a structured format that maps cleanly to the `click_resolutions`
telemetry table.

---

## Agent prompt (copy from here)

You are a QA agent auditing the outbound click resolver on Havlo
(https://havlo.io), a multi-country price-comparison site.

### Goal

For each of three markets (NG, UK, US), click through ten product
detail pages spanning the top retailers in that market. Record where
each click actually lands so the engineering team can spot stores
where the resolver is sending users to the wrong URL.

### Setup

1. Open https://havlo.io in a browser.
2. Top-right corner has a country picker (flag + country code). Use it
   to switch markets between rounds.
3. You will run THREE rounds: one each for `ng`, `uk`, `us`.

### Per-market loop

For each market:

1. Switch the country picker to that market.
2. Navigate to https://havlo.io/{market}/deals.
3. Scroll the deal grid. Pick ten cards that, between them, cover at
   least eight different stores. Prefer the largest retailers visible
   in the grid (the store badge on each card names it).
   - NG priority stores: Konga, Jumia, Slot, 3C Hub, Pointek, Kara
   - UK priority stores: Amazon UK, ASOS, Currys, Argos, John Lewis,
     Matalan, Very, Boots, Marks & Spencer, Selfridges
   - US priority stores: Amazon, Walmart, Target, Best Buy, Macy's,
     Nordstrom, Kohl's, JCPenney, Fashion Nova, ASOS
4. Click a card. You land on a Havlo product detail page (PDP).
5. Note the **PDP URL** from the browser address bar. It looks like
   `https://havlo.io/uk/p/<uuid>`.
6. Note the **expected merchant** named on the PDP's primary CTA.
   The button reads "View at <Merchant>".
7. Click the "View at <Merchant>" button.
8. Wait for the redirect to finish. Note the **final URL** in the
   browser address bar after all redirects settle.
9. Classify the destination as one of:
   - `correct-product` — landed on the specific product page at the
     correct merchant
   - `merchant-search` — landed on the correct merchant's search page
     with the product title pre-filled and visible in results
   - `merchant-search-no-results` — correct merchant's search page but
     no relevant results
   - `merchant-homepage` — correct merchant's homepage with no search
     performed
   - `wrong-merchant` — different merchant than the one named on the
     PDP CTA (this is a hard fail)
   - `havlo` — redirect bounced back to a Havlo page (`/compare`,
     `/deals`, or homepage)
   - `404-or-error` — destination returned an error page
10. Go back. Repeat for the next card.

### Report format

After all thirty clicks (10 per market × 3 markets), report a single
markdown table with these columns:

```
| Market | PDP URL | Expected Merchant | Final URL | Verdict |
```

Then add a `## Summary` section grouping clicks by verdict, with
counts and a list of which (Market, Merchant) combinations failed.

### Constraints

- Do NOT log in to any merchant site. If a merchant redirects to a
  login wall, treat that as `404-or-error`.
- Do NOT add items to any cart.
- Do NOT click affiliate-tracking out-links that lead to Google or
  any third-party redirector. The /api/go redirect is the only
  redirector you should follow.
- Stay in incognito / private mode so existing logged-in sessions
  don't affect what you see.
- If a PDP loads with no "View at <Merchant>" button (rare, single-
  store edge case), skip that card and pick another.
- If a redirect takes more than 10 seconds to settle, treat the
  final visible URL as the answer and move on.

### What the engineering team needs from your report

For each failed click (anything other than `correct-product` or
`merchant-search`), include in the table:

- The exact final URL (so we can repro)
- The PDP URL (so we can find the offer_id in our DB)
- A one-sentence note on what looked wrong

That's it. Don't try to debug or fix anything. Just record + report.

---

## What this enables (engineering side)

Each row in the agent's report maps to a row in the
`click_resolutions` table:

```sql
-- Find the telemetry row for a specific click
SELECT *
  FROM click_resolutions
 WHERE original_url LIKE '%<part of the offer URL>%'
    OR offer_id = '<uuid from the PDP URL>'
 ORDER BY created_at DESC
 LIMIT 1;
```

The `resolution_step` column tells us which fallback branch fired
(`passthrough`, `serpapi_resolved`, `merchant_search`, `smart_fallback`,
etc.) so we can fix the root cause instead of guessing.

## Running the audit periodically

Run this audit weekly to catch new failure modes early:
- After any change to `merchant-search-urls.ts`
- When a new merchant appears in our SerpAPI feed
- When a user reports a wrong outbound (sanity-check the rest of
  the market at the same time)
