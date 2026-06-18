# Havlo Vertical-Depth Plan — own tech comparison in every market

Goal: stop being broad-and-thin and become deep in the one vertical that is actually
comparable, in all 6 active markets. Prep work (this doc + the diagnosis) costs no SerpAPI
credits; only the ingestion saturation does, and that is run + scoped by the founder.

## The finding (live data, Jun 2026)

Phones is the #1 comparison-dense category in EVERY country, with computing / audio / gaming
right behind. Everything non-tech is comparison-dead everywhere. "any-store" includes
cross-border offers; "local" is in-country stores only.

| Country | Phones | Computing | Audio | Gaming | Biggest dead inventory |
|---|---|---|---|---|---|
| NG | **41% / 32%** | 50% / 5% | 25% / 12% | 36% (n=14) | supermarket 1,212 @ 1%, beauty 759 @ 2% |
| UK | **57% / 29%** | 33% / 11% | 32% / 15% | 20% / 11% | fashion 3,419 @ 1% |
| US | **45% / 20%** | 30% / 13% | 25% / 11% | 30% / 17% | "all" 439 @ 4%, health 171 @ 6% |
| IN | **49% / 12%** | 26% / 3% | 18% / 6% | 23% / 10% | electronics 67 @ 10%, fashion 43 @ 5% |
| AE | **44% / 15%** | 36% / 5% | 10% / 0% | — | appliances 81 @ 6%, audio 84 @ 10% |
| ZA | **62% / 23%** | — | 12% / 3% | — | audio 59 @ 12% |

Two universal truths:
1. **Phones is the wedge in every market.** One global strategy, not six.
2. **Cross-border is the density multiplier.** any-store >> local everywhere except the US
   (which has real local retailer depth). The second seller is usually abroad.

## Strategy

- **Lead vertical, all markets: PHONES.** Then computing, audio, gaming.
- **Tier-2 adjacent (ride the same stores + cross-border): electronics, appliances** —
  high-ticket, so even 10-15% density saves real money.
- **De-emphasize for comparison (keep in catalog for SEO long-tail ONLY, stop spending
  ingest credits to densify them): fashion, beauty, health, supermarket, home.** They are
  structurally 0-15% and cannot be fixed.
- Lead the homepage + category nav with phones/tech per country so the dense surface is the
  one users hit first.

## Head-product spine (the families to saturate)

These are the ingest targets: for each, pull every local tech store + a cross-border offer.

**Global core (sells in all 6 markets — one list):**
Apple: iPhone 13 / 14 / 15 / 16 (+ Plus / Pro / Pro Max), iPad (10th gen / Air / Pro),
MacBook Air M2/M3, MacBook Pro M3, AirPods Pro 2, AirPods 4, AirPods Max, Apple Watch SE/9/10.
Samsung: Galaxy S23/S24/S25 (+ Ultra), Galaxy A15/A35/A55, Galaxy Z Flip/Fold, Galaxy Buds,
Galaxy Watch, Samsung TVs (Crystal UHD, QLED). Audio: Sony WH-1000XM5/XM6, Bose QC Ultra,
JBL Charge/Flip/Tune, Anker Soundcore. Gaming: PS5 (+ Slim), Xbox Series S/X, Nintendo Switch
(+ OLED). Compute: HP / Lenovo / Dell mainstream laptops. Power: Anker power banks.

**Per-country additions (budget / local brands that drive volume):**
- **NG:** Tecno (Spark, Camon, Phantom, Pop), Infinix (Hot, Note, Zero, Smart), itel (A/P/S),
  Oraimo (earbuds, power banks, smartwatch), Redmi (A/Note), Nokia, Gionee.
- **IN:** Redmi/Xiaomi (Note, A), Realme (C, Narzo, P), OnePlus (Nord, R), Vivo (Y, V, T),
  Oppo (A, Reno), iQOO, boAt + Noise (audio/wearables, huge in IN), Samsung M-series.
- **AE:** premium-heavy — flagship Apple/Samsung, Huawei, Honor, Anker, JBL; staples from
  Sharaf DG / Noon / LuLu.
- **ZA:** Samsung, Apple, Hisense (TVs + appliances), Huawei, Oppo, HP/Lenovo; Takealot staples.
- **UK:** + Google Pixel, Sony, Dyson, Ninja / Shark (kitchen), Sonos, Garmin, Nintendo.
- **US:** + Google Pixel, Motorola, TCL/Hisense TVs, Beats, Ninja / Instant Pot / iRobot,
  Samsung/LG appliances.

(~20-30 families per market; the global core does most of the work, locals fill the tail.)

## Identifier / matching diagnosis (the GTIN question)

| Identifier | In-stock coverage | Verdict |
|---|---|---|
| `gtin` (barcode) | **0.2%** | DEAD END. Don't chase it. |
| `mpn` (part number) | **0.2%** | DEAD END. |
| `google_shopping_id` | **37.1%** | THE lever. Google's cross-merchant product key. |

Why GTIN is a dead end here: SerpAPI's `google_shopping` engine does NOT return the barcode in
its result rows; the `google_product` detail endpoint that carried real GTINs is deprecated
(returns "no longer offered"); and most merchant pages (especially NG/budget) don't publish
GTIN in Schema.org JSON-LD, so `backfill-identifiers-jsonld.ts` finds little. 0.2% is a
SOURCE limit, not a harvest bug.

What to do instead:
1. **Match-first on `google_shopping_id`.** It is free on every SerpAPI Shopping result and
   already groups the same product across merchants. The matcher has the `gshHits` path
   (`ingestion.ts`); make sure it is captured on 100% of SerpAPI-shopping offers and used
   before title/embedding. This is the cheapest density you can recover.
2. **The 63% without a gsh** are the NG-merchant site-scoped lane (`engine=google` +
   `site:domain`) and the free Jumia/Konga/Shopify/Woo scrapers, which don't return a Google
   product key. For these, density depends entirely on **title/model/variant normalization +
   the embedding/LLM matcher** — so invest there for the local lane (brand+model canonical
   keys, storage/RAM/colour grouping).

## Execution plan (cost-aware)

1. Lock the head-product spine above.
2. **Cross-border first (best density-per-credit):** for each head product, ensure an
   Amazon / AliExpress / Ubuy / eBay offer with landed cost. One `google_shopping` sweep per
   head product (UK/US/IN/AE/ZA) returns many sellers + a gsh in a single call — far more
   density per credit than broad category sweeps.
3. **Local saturation:** in NG (no `google_shopping` support) run the site-scoped NG-merchant
   lane per head product across Slot, 3CHub, Jumia, Konga, Kara, Pointek, Obiwezy (+ add
   Fouani, Justfones-type tech retailers). Other markets: add their tech retailers.
4. Lean matching on `google_shopping_id`; normalize titles for the local lane.
5. Variant grouping (storage / RAM / colour) so same-config compares.
6. Re-run the per-country density-by-category query to measure. Targets: phones 40→70%,
   computing/audio meaningfully up, in every market.

Credit note: head-product targeting is MORE credit-efficient for density than the current
broad category sweeps, because each query hits a product that actually has multiple sellers.
Reallocate spend from broad fashion/beauty/supermarket sweeps (dead density) to this list.

## What NOT to do
- Don't chase GTIN/MPN (unavailable from your sources).
- Don't try to densify fashion / beauty / health / supermarket / home (structurally impossible).
- Don't spread ingest credits across the 22k long tail; concentrate on the head-product spine.
