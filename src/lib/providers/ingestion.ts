/* ──────────────────────────────────────────────────────────────────
   Ingestion writer — takes Deal[] from any provider and upserts into
   products + offers tables.

   Used by:
     • scripts/ingest-providers.ts (cron-runnable)
     • Future API routes that want to persist live results
   ────────────────────────────────────────────────────────────────── */

import type { Deal } from "@/types";
import { getSupabaseAdmin } from "./db-client";
import { buildSignature } from "@/lib/search/normalize";
import { inferStoreCountry, isGlobalIntlStore } from "@/lib/country";
import { categoryDisagreesWithTitle } from "@/lib/categorize";
import { categories } from "@/lib/data/categories";
import { canonicaliseOfferUrl } from "@/lib/url-helpers";
import { priceLooksPlausible } from "@/lib/search/price-floor";
import { rewriteMerchantUrl } from "@/lib/merchant-url-rewrite";

/* Secret-scrubber leakage guard. The upstream provider chain has a
   middleware that replaces detected secrets (JWTs, API keys, OAuth
   tokens) with the literal string '[BLOCKED: <type>]'. When that
   middleware mis-fires on a store record the placeholder lands in
   storeId / storeName and the row becomes catalog junk. QA report
   May 2026 found '[BLOCKED: JWT token]' surfacing as a storeId in
   3 NG and 2 US rows. This guard drops affected deals at the door. */
function isBlockedSentinel(s: string | null | undefined): boolean {
  return !!s && /\[BLOCKED:\s*[^\]]+\]/i.test(s);
}

/* Normalise a raw identifier (GTIN / MPN / Google Shopping ID) into
   the canonical form the DB stores, or null if the value is missing /
   junk. Three steps:
     1. Trim — providers occasionally emit values with trailing space
        ("  012345678910 ").
     2. Drop blocked-sentinel leaks (same defensive guard as storeId).
     3. Drop empty strings (some providers emit "" for "absent" rather
        than omitting the field). NULL is the correct DB representation.
   GTIN/MPN/gsh casing is preserved as-is — these are opaque tokens,
   not human strings. Future: tighten GTIN validation (length, checksum)
   if we see junk values flowing in. */
function cleanIdentifier(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t) return null;
  if (isBlockedSentinel(t)) return null;
  return t;
}

export interface IngestResult {
  fetched: number;
  upserted: number;
  errors: string[];
}

/* ── Helpers ──────────────────────────────────────────────────────── */

interface StoreRow {
  id: string;
  name: string;
  country: string | null;
  url: string | null;
  logo_url: string | null;
  is_international: boolean;
  trusted: boolean;
}

function dealToStoreRow(d: Deal, sourceQuery: string): StoreRow {
  /* `is_international` retains its original currency-based heuristic
     (USD = international price tag) since downstream filters lean on
     it as a proxy for 'has cross-border price'.

     `country` uses a THREE-layer resolution (May 2026 phase-3 audit
     widened it from two layers — the third catches ~110 stores that
     were leaking through as NULL-country in production):

       1. inferStoreCountry — JS-roster match (most reliable when the
          store IS in COUNTRY_STORES). Returns canonical country code.

       2. Country-tag fallback — SerpAPI / curated providers write a
          `country:xx` tag on every Deal indicating which country's
          query surfaced it. Most reliable signal for stores not in
          any JS roster.

       3. sourceQuery trailing `:xx` parse — the ingest CLI's query
          conventions encode the country in the trailing two-letter
          suffix (`phones:us`, `health:de`, `audio:uk`, `curated:iPhone
          15 Pro Max:us`, etc.). When the upstream provider DIDN'T set
          a `country:` tag on the Deal but the caller knew which country
          this batch was for, we can still recover. Critical for the
          live-search persist path which doesn't always carry country
          tags but does encode them in the source_query.

     Truly global cross-border stores (AliExpress / DHGate / Shein /
     Temu) appear in MULTIPLE countries' tags AND aren't in any
     country roster — they stay NULL via this path because the
     `isGlobalIntlStore` short-circuit prevents the fallbacks.

     Added May 2026 phase-3 audit: 68 stores in production (B&H Photo,
     Holland & Barrett, BigBasket, Trendyol, Boohoo, Galaxus, etc.)
     had NULL country despite all their offers agreeing on a single
     source_country — they were invisible to the /local-tab filter
     even though store_country in their offer rows said otherwise.
     Layer 3 closes that gap for any future ingest. */
  const isIntl = d.currency === "USD";
  let country = inferStoreCountry(d.storeId, d.storeName);
  if (!country && !isGlobalIntlStore(d.storeId, d.storeName)) {
    /* Country-tag fallback. SKIP for known multi-market stores
       (AliExpress / Shein / Temu / DHgate / etc.) — those legitimately
       appear in queries from MANY countries and shouldn't be anchored
       to whichever one happened to be the most-recent ingest. */
    const countryTag = d.tags.find((t) => t.startsWith("country:"));
    if (countryTag) {
      const cc = countryTag.slice("country:".length).toUpperCase();
      if (/^(NG|UK|US|DE|AE|IN|ZA)$/.test(cc)) {
        country = cc;
      }
    }
    /* Layer 3: source_query trailing `:xx` parse. Same regex as
       `inferSourceCountry` for the offer row so the store country
       agrees with the offer's source_country. Only fires when:
         a. inferStoreCountry returned null (not in JS roster), AND
         b. Deal.tags lacks a `country:` tag, AND
         c. The store isn't a known global cross-border merchant.
       That intersection is exactly the case the production audit
       found — a real long-tail retailer with no roster entry, no
       tag, but a sourceQuery the ingest CLI wrote with the country
       suffix. NOTE: leading `country:` prefixes like `ng:Apple…`
       are visitor-market markers, not store anchors — we only
       parse the TRAILING `:xx` to avoid that confusion. */
    if (!country && sourceQuery) {
      const m = sourceQuery.match(/:([a-z]{2})$/i);
      if (m) {
        const cc = m[1].toUpperCase();
        if (/^(NG|UK|US|DE|AE|IN|ZA)$/.test(cc)) {
          country = cc;
        }
      }
    }
  }
  return {
    id:               d.storeId,
    name:             d.storeName,
    country,
    url:              null,
    logo_url:         `/logos/${d.storeId}.png`,
    is_international: isIntl,
    trusted:          true,
  };
}

/* Strip merchant-side "brand placeholders" from listing titles.

   Why: many marketplaces (Jumia, Walmart, Amazon Marketplace, Ubuy)
   require every listing to have a brand field. When the seller has
   no brand to list (white-label / unbranded goods, generic parts,
   knock-off accessories), they pick "Generic", "Unbranded", or
   "No Brand" from a dropdown. SerpAPI returns those titles verbatim:
   "Generic Universal Headphone Headband Cover for Sony WH-1000XM5"
   reads like a knock-off when really the product is just unbranded.

   May 2026 user audit: 24 of 280 Jumia products (~9%) had a
   leading "Generic " prefix. Walmart, Amazon UK, Ubuy, Ninja UAE
   each had isolated cases. Strip all three placeholder prefixes
   at the ingestion boundary so every store benefits uniformly.

   We DON'T touch "OEM" (legitimate signal: original-equipment-
   manufacturer parts) or brand-like uppercase tokens we don't
   recognise (avoid false positives that mangle real brands). */
const TITLE_PLACEHOLDER_BRANDS = /^(generic|unbranded|no\s*brand)\s*[-:|]?\s*/i;
/* Match any HTML tag — AliExpress's affiliate API wraps matched search
   keywords in <strong>...</strong> for inline highlighting. They land
   in our DB verbatim and render as literal "<strong>shoes</strong>"
   text on cards because the JSX layer renders titles as plain strings
   (no innerHTML). Phase 3 audit (May 2026) found 71 such products
   showing the raw markup to users. Stripping at ingest fixes this
   for new rows; a backfill closes the gap on existing ones.

   The regex matches both `<tag>` and `</tag>` forms and is non-greedy
   so it doesn't gobble across multiple tags. We DON'T decode entities
   here (no &amp; → &) because that's a separate concern and entities
   in titles are far rarer; the title-content invariant is "no markup
   tokens, plain text only". */
const HTML_TAG = /<\/?[a-z][^>]*>/gi;
function cleanProductTitle(raw: string): string {
  /* HTML strip runs FIRST so any "Generic <strong>X</strong>" gets
     "<strong>" stripped to "Generic X", then the brand-placeholder
     pass below can recognise and remove "Generic". */
  let t = raw.trim().replace(HTML_TAG, "");
  /* Iterate so "Generic Unbranded X" → "X". Cap iterations to 3 so a
     pathologically chained title can't cause a runaway. */
  for (let i = 0; i < 3; i++) {
    const next = t.replace(TITLE_PLACEHOLDER_BRANDS, "").trim();
    if (next === t) break;
    t = next;
  }
  /* Collapse runs of internal whitespace introduced by the strip. */
  return t.replace(/\s{2,}/g, " ");
}

/* Normalise a product title into a stable join key for cross-ingest
   dedup. Lowercase, strip all non-alphanumeric, cap at 120 chars.
   MUST match the SQL backfill in migration 0046 exactly so the
   ingest-side and DB-side computations agree on what counts as a
   duplicate.

   Catches: same product re-ingested with different URL query params,
   same product across stores when the signature parser couldn't
   extract brand+model (~50% of titles), Jumia rows with the
   "Generic " prefix stripped (cleanProductTitle runs first). */
export function normaliseTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 120);
}

function dealToProductRow(d: Deal, signature: string | null) {
  /* Strip merchant-side brand placeholders ("Generic", "Unbranded",
     "No Brand") before any other title work — every downstream
     consumer (signature/dedup, search FTS, category inference, card
     render, email digest) sees the cleaned form. */
  const cleanedTitle = cleanProductTitle(d.title);

  /* Auto-correct mistagged categories at ingest time.

     Why: ingest-providers.ts tags every result from a 'phones' query
     with categorySlug='phones', regardless of whether the actual
     result is a phone. SerpAPI's match for the query 'Phones' will
     occasionally return a Bluetooth speaker or AI sunglasses, and
     before this fix those rows landed in the Phones filter on /deals.
     The QA agent flagged this as a top-of-funnel trust killer.

     Logic: if title-based inference disagrees with the source slug,
     OVERRIDE to the inferred slug. If inference returns null
     (unrecognised), keep the source slug — better to over-tag than
     to lose the data. */
  const { disagrees, inferred } = categoryDisagreesWithTitle(d.categorySlug, cleanedTitle);
  const correctedSlug = disagrees && inferred ? inferred : d.categorySlug;
  const correctedCategory = disagrees && inferred
    ? (categories.find((c) => c.slug === inferred)?.name ?? d.category)
    : d.category;

  /* Populate brand + model from the signature parser. Was previously
     hardcoded null even though buildSignature(title) had already
     extracted them — an old TODO that nullified the variant-gate's
     brand-equality guard (both sides null → no-op check). May 2026
     fix: persist what the parser found. */
  const parsed = buildSignature(cleanedTitle, {
    gtin:             d.gtin,
    mpn:              d.mpn,
    googleShoppingId: d.googleShoppingId,
  });

  return {
    title: cleanedTitle,
    description: d.description ?? null,
    category: correctedCategory,
    category_slug: correctedSlug,
    brand: parsed.brand,
    model: parsed.model,
    image_url: d.imageUrl ?? null,
    /* Empty-string signature → NULL in the DB. buildSignature returns
       "" when it can't extract both brand AND model (May 2026 audit:
       69% of catalog falls into this bucket — Fashion, Beauty, etc.).
       Writing NULL instead of "?|?" / "brand|?" stops the heuristic
       clustering from grouping unrelated products together (the
       Samsung-TVs-with-Samsung-fridges-with-Samsung-earbuds problem).
       Cross-store dedup still works via title_key, which is the right
       signal for descriptive titles. */
    signature: signature && signature.length > 0 ? signature : null,
    /* title_key — stored normalized form for fast dedup lookup.
       See normaliseTitleKey() above + migration 0046 for the design
       rationale. Must match the SQL backfill formula. */
    title_key: normaliseTitleKey(cleanedTitle),
    /* Structured product identifiers (Phase 1 product-match upgrade).
       Each is a much stronger same-product signal than the heuristic
       brand|model signature. Persisted whenever the provider surfaces
       them; absent rows stay NULL and fall back to the existing
       signature/title_key dedup paths. The identifier-based dedup
       pass in ingestDeals() below uses these BEFORE the signature
       pass so the strongest signal wins. */
    gtin:               d.gtin ?? null,
    mpn:                d.mpn ?? null,
    google_shopping_id: d.googleShoppingId ?? null,
  };
}

/* Extract the country code from either:
   1. The Deal.tags array (`country:xx` — set by SerpAPI provider)
   2. The sourceQuery suffix (e.g. "phones:uk" — set by ingest CLI)
   3. NGN-currency offers default to "ng" (scraper-sourced)
   Returns null when no signal is available — the offer becomes "global"
   from the country-filter's perspective (cross-border like Shein/Temu). */
function inferSourceCountry(d: Deal, sourceQuery: string): string | null {
  const tag = d.tags.find((t) => t.startsWith("country:"));
  if (tag) return tag.slice("country:".length).toLowerCase();
  const m = sourceQuery.match(/:([a-z]{2})$/i);
  if (m) return m[1].toLowerCase();
  if (d.currency === "NGN") return "ng";
  return null;
}

function dealToOfferRow(
  d: Deal,
  productId: string,
  sourceProvider: string,
  sourceQuery: string,
  runStartedAt: string,
) {
  return {
    product_id: productId,
    store_id: d.storeId,
    /* Two URL transforms applied in order:

       1. rewriteMerchantUrl — fixes known-broken merchant URLs at
          the storeId level. User-reported May 29 2026: The Range's
          SerpAPI link was `therange.com/lander` (wrong domain +
          internal affiliate path that no longer routes), so every
          click 404'd. The Range rewriter swaps to
          `therange.co.uk/search?q=<title>` — guaranteed-valid
          domain + search hits the right product reliably. No-op
          for stores without a registered rewriter.

       2. canonicaliseOfferUrl — strips tracking-only query params
          (utm_*, gclid, fbclid, msclkid, Shopify _pos/_fid/_ss,
          Konga cid, etc.) so the (store_id, url) uniqueness
          constraint sees the same stable URL across cron runs.
          Without this, threechub stored 27 offers for one phone
          (rotating ?_pos=&_fid=&_ss=), konga stored 25 per PS4
          controller (rotating ?cid=).

       Order matters: rewrite FIRST so the canonicaliser operates
       on the corrected URL (the rewritten Range search URL has
       no tracking params, so this step is effectively a no-op for
       rewritten rows — but other stores' rewriters might leave
       params worth normalising). */
    url: canonicaliseOfferUrl(rewriteMerchantUrl(d.url, d.storeId, d.title)),
    current_price: d.salePrice,
    /* Store NULL for original_price when there's no actual markdown.
       Many providers (Jumia, AliExpress raw, sparse Walmart feeds)
       have no MSRP signal — they pass originalPrice === salePrice to
       satisfy the Deal type's `number` field. Storing that equality
       in the DB is dishonest: it claims we observed a "was" price
       when we never did. Null is the right semantic for "no markdown
       known"; price-history and the discount-badge renderer already
       short-circuit on null without rendering a fake "0% OFF" pill.

       A genuine markdown (original > sale) preserves the original
       value as before. */
    original_price: (d.originalPrice && d.originalPrice > d.salePrice) ? d.originalPrice : null,
    discount_percent: (d.discountPercent ?? 0) > 0 ? d.discountPercent : null,
    currency: d.currency,
    /* is_deal — relaxed (May 2026 audit). Was: "true only when
       discountPercent > 0" → quietly hid 38% of the catalog from
       /deals (7,632 in-stock offers): all of Jumia, all of HealthPlus,
       all of MedPlus, all of DHgate, 95% of ASOS, 28% of AliExpress
       — every store whose ingest path doesn't surface an MSRP. The
       store filter dropdown on /deals also relied on is_deal=true,
       so those stores never appeared as filter options either.

       New semantic: "this offer is a valid, in-stock, ready-to-show
       row in the deals catalog." discount_percent is the actual
       deal-ness signal; sort-by-discount still floats real markdowns
       to the top, and the discount badge only renders when % > 0
       (no fake "0% OFF" badges anywhere).

       Rows where salePrice isn't a real positive number (broken
       scrape, free placeholder, malformed feed) still get
       is_deal=false so they stay hidden. */
    is_deal: (d.salePrice ?? 0) > 0,
    /* Always (re)mark as in_stock on a successful upsert. The
       staleness sweep below flips offers that DIDN'T get touched
       this run, so re-stamping here is the "I saw this URL this
       run" half of the contract. */
    in_stock: true,
    source_provider: sourceProvider,
    source_query: sourceQuery,
    source_country: inferSourceCountry(d, sourceQuery),
    scraped_at: new Date().toISOString(),
    /* last_seen_at uses the RUN-START timestamp, not now(), so every
       offer touched in the same run shares a single stamp. The sweep
       below selects `last_seen_at < runStartedAt`, so using `now()`
       per-row would make that boundary fuzzy (an offer upserted at
       run+30s would be 30s newer than the run start and could leak
       into a future run's sweep window). Migration 0018 adds the
       column with default now() for safety; we override here. */
    last_seen_at: runStartedAt,
  };
}

/* Options bag for ingestDeals. Most callers don't need this — the
   defaults are conservative (no staleness sweep, no destructive
   side-effects). */
export interface IngestOptions {
  /** When the caller has just walked a store's FULL public catalog,
      pass `{ store: storeId }` so ingestDeals can soft-delete offers
      that weren't seen this run (mark them in_stock=false). The
      sweep is only safe for full-catalog scrapers — per-category /
      per-SKU ingest must leave this undefined. */
  sweepScope?: { store: string };
}

/** Minimum deal count BEFORE the sweep is allowed to run. Catches
    the catastrophic case where a Playwright run breaks partway and
    only returns a handful of items — without this threshold we'd
    mark the rest of the catalog as out of stock. */
const MIN_DEALS_FOR_SWEEP = 10;

/** Sweep is skipped when the new batch is smaller than this
    fraction of the existing in-stock count for the store. A 60%
    drop in catalog size between runs is almost always a scraper
    regression, not a genuine delisting wave. */
const MIN_BATCH_FRACTION_OF_EXISTING = 0.4;

/* ── Main ingestion function ──────────────────────────────────────── */

/**
 * Upsert a batch of Deals from a provider into the DB.
 *
 * Strategy:
 *   1. Upsert all unique stores in one batch
 *   2. For each deal:
 *      a. Compute its signature
 *      b. Look up existing product by signature (or insert new)
 *      c. Upsert offer (unique by store_id + url)
 *   3. Record an ingestion_run row for telemetry
 */
export async function ingestDeals(
  sourceProvider: string,
  sourceQuery: string,
  deals: Deal[],
  options: IngestOptions = {},
): Promise<IngestResult> {
  const result: IngestResult = { fetched: deals.length, upserted: 0, errors: [] };
  const supa = getSupabaseAdmin();

  if (!supa) {
    result.errors.push("Supabase client not configured (need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
    return result;
  }

  /* Pre-filter: drop deals whose storeId / storeName / title contains
     a secret-scrubber sentinel like '[BLOCKED: JWT token]'. Those rows
     were leaking from an upstream middleware mis-fire and surfacing as
     catalog junk (3 NG + 2 US rows in QA report May 2026). Rejecting
     at the door beats trying to clean up downstream. */
  const blockedRejects = deals.filter((d) =>
    isBlockedSentinel(d.storeId) ||
    isBlockedSentinel(d.storeName) ||
    isBlockedSentinel(d.title),
  );
  if (blockedRejects.length > 0) {
    result.errors.push(`Rejected ${blockedRejects.length} deals containing [BLOCKED: …] sentinel`);
  }
  deals = deals.filter((d) => !blockedRejects.includes(d));

  if (deals.length === 0) return result;

  /* Pinned at the start of the run. Every offer upserted below
     gets this exact stamp as `last_seen_at`, so the post-loop
     sweep can cleanly select `last_seen_at < runStartedAt` without
     race conditions between upserts and the sweep. */
  const runStartedAt = new Date().toISOString();

  // Open a run record
  const { data: run, error: runErr } = await supa
    .from("ingestion_runs")
    .insert({ provider: sourceProvider, query: sourceQuery, status: "running" })
    .select("id")
    .single();

  if (runErr || !run) {
    result.errors.push(`Could not open ingestion_run: ${runErr?.message ?? "unknown"}`);
    return result;
  }

  // 1. Upsert stores
  /* Two-pass write so the `country` column is non-destructive:
       Pass A — upsert every store row WITHOUT the country field, so
                existing country values on conflicting rows are
                preserved (Supabase PostgREST honours field-level
                inclusion: omitting `country` keeps the existing
                value on UPDATE rather than writing NULL).
       Pass B — for rows that DID infer a country, run a
                country-only UPDATE filtered to `country IS NULL`,
                so we only fill blanks. Never overwrites an
                already-set country with a different value.

     Why this matters: an earlier code path could create a store
     with country='US' (Deal had country:us tag), then a later ingest
     where that tag was absent would call upsert with country=null
     and silently destroy the tag. Production audit found 110 stores
     in this state. Layer 3 fallback above prevents NEW gaps; this
     two-pass shape stops the upsert from CLOBBERING good data. */
  const uniqueStores = new Map<string, StoreRow>();
  for (const d of deals) uniqueStores.set(d.storeId, dealToStoreRow(d, sourceQuery));
  const allRows = Array.from(uniqueStores.values());

  /* Pass A: write everything except `country`. */
  type StoreRowNoCountry = Omit<StoreRow, "country">;
  const passARows: StoreRowNoCountry[] = allRows.map((r) => {
    /* Build the object explicitly so we never send `country: null`
       and inadvertently overwrite an existing value. */
    return {
      id:               r.id,
      name:             r.name,
      url:              r.url,
      logo_url:         r.logo_url,
      is_international: r.is_international,
      trusted:          r.trusted,
    };
  });
  const { error: storeErr } = await supa
    .from("stores")
    .upsert(passARows, { onConflict: "id" });
  if (storeErr) result.errors.push(`Store upsert: ${storeErr.message}`);

  /* Pass B: backfill country only where it's currently NULL. */
  const withCountry = allRows.filter((r) => r.country !== null);
  if (withCountry.length > 0) {
    /* One UPDATE per inferred country bucket — fewer round trips than
       per-row updates, and the filter is the same (country IS NULL +
       id IN (…)) so a bucket is naturally one query.

       forEach iteration (not for-of) so the project's es2017 target
       doesn't choke on Map iterators without downlevelIteration. */
    const byCountry = new Map<string, string[]>();
    for (const r of withCountry) {
      const cc = r.country!;
      if (!byCountry.has(cc)) byCountry.set(cc, []);
      byCountry.get(cc)!.push(r.id);
    }
    const buckets: Array<[string, string[]]> = [];
    byCountry.forEach((ids, cc) => buckets.push([cc, ids]));
    for (const [cc, ids] of buckets) {
      const { error: backfillErr } = await supa
        .from("stores")
        .update({ country: cc })
        .in("id", ids)
        .is("country", null);
      if (backfillErr) {
        result.errors.push(`Store country backfill (${cc}, ${ids.length} ids): ${backfillErr.message}`);
      }
    }
  }

  /* ── 2. Batched dedup + upsert (May 2026 perf refactor) ─────────
     The previous per-deal loop did 3-5 sequential round trips per
     row (URL dedup SELECT, signature dedup SELECT, possible
     product fetch, INSERT/UPDATE product, UPSERT offer). For the
     SerpAPI cron — 6 countries × 10 categories × 50 deals = 3000
     rows — that produced ~10-15k round trips and pushed the ingest
     job past GitHub's 25-min timeout.

     New shape: TWO bulk lookups + ONE per-deal loop in memory + at
     most ONE write call per deal (insert OR update OR neither).

     Result for a 50-deal call: ~3 round trips before the loop +
     ~50 individual writes (each writes a product or upsert offer).
     Round trips drop ~10x. Per-call latency drops from ~15-30s
     cold to ~3-6s.

     N+1 issue tracked in the workflow comment (60m timeout was
     set because of this exact issue; should now drop back to
     ~20-25m for the full job). */

  const sigs = deals.map((d) => buildSignature(d.title));
  /* Pre-compute title_key for every deal so the cross-store dedup
     pass (Step 2b below) can bulk-lookup existing products by
     normalized title. cleanProductTitle is applied here too so the
     "Generic " prefix and similar merchant-side placeholders are
     stripped before normalization — matches what dealToProductRow
     writes when inserting a new product.

     The URL is canonicalised UP-FRONT (not just at write time) so
     every downstream step — Bulk lookup 1 (existing offers by URL),
     the offer upsert's conflict key, and the WHERE clause that
     keeps a single row per (store_id, url) — sees the same stable
     URL. Without this, an incoming raw URL with a fresh tracking
     suffix would miss the lookup against the previously-canonicalised
     stored form, fall through to the title_key path (which works,
     but at extra cost), and only land on the existing row at the
     final upsert via the (store_id, url) constraint. */
  const offerUrls = deals.map((d, i) => ({
    i,
    storeId:  d.storeId,
    url:      canonicaliseOfferUrl((d.url ?? "").trim()),
    sigKey:   sigs[i].key,
    canDedup: sigs[i].brand !== null && sigs[i].model !== null,
    titleKey: normaliseTitleKey(cleanProductTitle(d.title)),
    /* Structured identifiers — drives the new Phase 1 dedup pass
       (Bulk lookup 0 / Step 0 below). Sanitized at the boundary:
       trim + ignore the [BLOCKED:...] sentinel that the secret-
       scrubber middleware sometimes emits. brand is captured here
       because MPN dedup is brand-scoped (different brands can
       reuse a part-number string). */
    gtin:             cleanIdentifier(d.gtin),
    mpn:              cleanIdentifier(d.mpn),
    googleShoppingId: cleanIdentifier(d.googleShoppingId),
    brand:            sigs[i].brand,
  }));

  /* Bulk lookup 0: existing products by structured identifier
     (GTIN / MPN / Google Shopping ID).
     ─────────────────────────────────────────────────────────────
     Phase 1 product-match upgrade. These are the strongest sameness
     signals available — when two offers share a GTIN they ARE the
     same product, no heuristic gates needed. Runs BEFORE the
     signature and title_key lookups so the highest-confidence path
     wins.

     Cheap: at most 3 small IN queries, each filtered by a partial
     unique/composite index (migration 0049). Most batches won't
     have many identifiers populated until a few weeks post-deploy,
     so these IN sets are typically short.

     `gtinHits` and `gshHits` are keyed on the identifier itself
     (globally unique). `mpnHits` is keyed on `<brand>:<mpn>` because
     MPN is brand-scoped (different brands may reuse part-number
     strings — "M1" alone is ambiguous). */
  const gtinValues = Array.from(new Set(
    offerUrls.map((o) => o.gtin).filter((v): v is string => !!v),
  ));
  const gshValues = Array.from(new Set(
    offerUrls.map((o) => o.googleShoppingId).filter((v): v is string => !!v),
  ));
  const mpnValues = Array.from(new Set(
    offerUrls
      .filter((o) => o.mpn && o.brand)
      .map((o) => o.mpn as string),
  ));

  const gtinHits = new Map<string, { id: string; image_url: string | null }>();
  const gshHits  = new Map<string, { id: string; image_url: string | null }>();
  const mpnHits  = new Map<string, { id: string; image_url: string | null }>();

  if (gtinValues.length > 0) {
    const { data: rows } = await supa
      .from("products")
      .select("id, image_url, gtin")
      .in("gtin", gtinValues);
    for (const r of (rows ?? []) as Array<{ id: string; image_url: string | null; gtin: string }>) {
      gtinHits.set(r.gtin, { id: r.id, image_url: r.image_url });
    }
  }
  if (gshValues.length > 0) {
    const { data: rows } = await supa
      .from("products")
      .select("id, image_url, google_shopping_id")
      .in("google_shopping_id", gshValues);
    for (const r of (rows ?? []) as Array<{ id: string; image_url: string | null; google_shopping_id: string }>) {
      gshHits.set(r.google_shopping_id, { id: r.id, image_url: r.image_url });
    }
  }
  if (mpnValues.length > 0) {
    const { data: rows } = await supa
      .from("products")
      .select("id, image_url, brand, mpn")
      .in("mpn", mpnValues);
    for (const r of (rows ?? []) as Array<{ id: string; image_url: string | null; brand: string | null; mpn: string }>) {
      if (r.brand) {
        mpnHits.set(`${r.brand.toLowerCase()}:${r.mpn}`, { id: r.id, image_url: r.image_url });
      }
    }
  }

  /* Bulk lookup 1: existing offers by (store_id, url) — one row per
     unique (store_id, url) pair. PostgREST .or() with .and() inside
     each clause is too verbose for ~50 pairs, but we can lean on
     the (store_id, url) being already-unique and use a single
     query with an IN against url values, then filter store_id in
     JS. Most cron runs hit one provider per call so store_id is
     largely uniform anyway. */
  const urls = Array.from(new Set(offerUrls.map((o) => o.url).filter(Boolean)));
  const offerHits = new Map<string, string>(); // key = `${storeId}:${url}` → product_id
  /* Chunked lookup — PostgREST URL cap is ~8KB. PayPorte's 1,480-URL
     daily ingest blew past that limit silently here (no error check
     on the original query — `rows` came back null, the loop ran over
     nothing, dedup missed every entry). Chunk by 100 URLs. */
  const OFFER_URL_CHUNK_SIZE = 100;
  for (let i = 0; i < urls.length; i += OFFER_URL_CHUNK_SIZE) {
    const chunk = urls.slice(i, i + OFFER_URL_CHUNK_SIZE);
    const { data: rows, error: rowsErr } = await supa
      .from("offers")
      .select("store_id, url, product_id")
      .in("url", chunk);
    if (rowsErr) {
      result.errors.push(`Offers-by-url probe (chunk ${Math.floor(i / OFFER_URL_CHUNK_SIZE) + 1}): ${rowsErr.message}`);
      continue;
    }
    for (const r of (rows ?? []) as Array<{ store_id: string; url: string; product_id: string }>) {
      offerHits.set(`${r.store_id}:${r.url}`, r.product_id);
    }
  }

  /* Bulk lookup 2: existing products by signature. Only signatures
     with parseable brand+model get a real lookup; the rest stay
     null and will trigger the title_key fallback below or fresh
     inserts. */
  const dedupKeys = Array.from(new Set(offerUrls.filter((o) => o.canDedup).map((o) => o.sigKey)));
  const sigHits = new Map<string, { id: string; image_url: string | null }>();
  if (dedupKeys.length > 0) {
    const { data: prodRows } = await supa
      .from("products")
      .select("id, image_url, signature")
      .in("signature", dedupKeys);
    for (const r of (prodRows ?? []) as Array<{ id: string; image_url: string | null; signature: string }>) {
      sigHits.set(r.signature, { id: r.id, image_url: r.image_url });
    }
  }

  /* Bulk lookup 2b: existing products by normalized title (title_key).
     Phase 2 audit (May 2026) found that ~50% of titles fail the
     brand+model signature extraction, so dedupKeys above misses them.
     Result pre-fix: re-ingesting the same product creates a new
     products.id row every cron (135 duplicates of one Beats earphone
     cover, 4,810 normalized-title collisions catalog-wide).
     title_key catches this: every title-identical product across
     stores collapses to one product row going forward. */
  const titleKeys = Array.from(new Set(
    offerUrls.map((o) => o.titleKey).filter((k) => k.length > 0),
  ));
  const titleHits = new Map<string, { id: string; image_url: string | null }>();
  if (titleKeys.length > 0) {
    const { data: titleRows } = await supa
      .from("products")
      .select("id, image_url, title_key")
      .in("title_key", titleKeys);
    for (const r of (titleRows ?? []) as Array<{ id: string; image_url: string | null; title_key: string }>) {
      /* If multiple existing products share a title_key (rare but
         possible — see migration 0046 comment on non-unique index)
         the first wins. The maint dedup pass merges true dupes via
         scripts/dedup-products.ts. */
      if (!titleHits.has(r.title_key)) {
        titleHits.set(r.title_key, { id: r.id, image_url: r.image_url });
      }
    }
  }

  /* Bulk lookup 3: when an offer hit gave us a product_id but its
     image_url is missing, we need to know which to backfill. Pull
     all hit product rows in one go. */
  const hitProductIds = Array.from(new Set(Array.from(offerHits.values())));
  const hitProducts = new Map<string, { id: string; image_url: string | null }>();
  if (hitProductIds.length > 0) {
    const { data: rows } = await supa
      .from("products")
      .select("id, image_url")
      .in("id", hitProductIds);
    for (const r of (rows ?? []) as Array<{ id: string; image_url: string | null }>) {
      hitProducts.set(r.id, r);
    }
  }

  /* ── Loop in memory: classify each deal as (existing | new).
        Writes are batched at the end. ──────────────────────────── */
  type NewProduct = { deal: Deal; sigKey: string; canDedup: boolean };
  const newProducts: NewProduct[] = [];
  const offerWrites: Array<{ deal: Deal; productId: string }> = [];
  const imageBackfills: Array<{ productId: string; imageUrl: string }> = [];
  /* product_ids inserted by THIS run (populated in Step 3). The
     Step 5b orphan-reconciliation pass uses this to delete any
     that ended up with no offer pointing at them. */
  const insertedProductIds: string[] = [];

  /* identifierBackfills — when an in-memory dedup pass matches an
     EXISTING product via signature/title_key/FTS but THIS deal carries
     a structured identifier the existing row doesn't have yet, queue
     a small UPDATE to backfill the identifier column. Cheap, one-shot:
     after the backfill any future ingest with the same identifier
     hits the row via Step 0's bulk lookup directly (faster + stronger
     than re-matching via signature each time). */
  const identifierBackfills: Array<{
    productId:        string;
    gtin?:            string | null;
    mpn?:             string | null;
    googleShoppingId?: string | null;
  }> = [];

  for (let i = 0; i < deals.length; i++) {
    const d = deals[i];
    const { url, storeId, sigKey, canDedup, titleKey, gtin, mpn, googleShoppingId, brand } = offerUrls[i];

    let existing: { id: string; image_url: string | null } | null = null;
    let matchedViaIdentifier = false;

    /* Step 0: structured-identifier dedup (in-memory). Highest-
       confidence path — when the deal carries a GTIN/MPN/gsh that
       matches an existing product row, we KNOW it's the same product.
       Runs before URL / signature / title_key because identifiers
       beat every heuristic. */
    if (!existing && gtin) {
      const hit = gtinHits.get(gtin);
      if (hit) { existing = hit; matchedViaIdentifier = true; }
    }
    if (!existing && googleShoppingId) {
      const hit = gshHits.get(googleShoppingId);
      if (hit) { existing = hit; matchedViaIdentifier = true; }
    }
    if (!existing && mpn && brand) {
      const hit = mpnHits.get(`${brand.toLowerCase()}:${mpn}`);
      if (hit) { existing = hit; matchedViaIdentifier = true; }
    }

    /* Step 1: existing-offer lookup (in-memory) */
    if (!existing && url && storeId) {
      const pid = offerHits.get(`${storeId}:${url}`);
      if (pid) existing = hitProducts.get(pid) ?? null;
    }

    /* Step 2: signature dedup (in-memory). Only fires when the
       signature parser extracted BOTH brand and model — covers the
       "high-confidence" half of the catalog. */
    if (!existing && canDedup) {
      const hit = sigHits.get(sigKey);
      if (hit) existing = hit;
    }

    /* Step 2b: title_key dedup (in-memory). Catches the rest: same
       product re-ingested with a slightly different URL, same
       product across stores when the signature parser failed,
       Generic-prefixed marketplace listings, etc. This is the pass
       that prevents the 4,810-collision pile-up the Phase 2 audit
       surfaced — without it, ingest creates a new products.id row
       on every cron for ~50% of products. */
    if (!existing && titleKey.length > 0) {
      const hit = titleHits.get(titleKey);
      if (hit) existing = hit;
    }

    /* When we matched via a non-identifier path (signature / title_key /
       URL) but the incoming deal carries an identifier, queue a backfill
       so the existing product row gets the identifier on its next save.
       Skip when we already matched via the identifier itself
       (matchedViaIdentifier) — that row obviously already has it. */
    if (existing && !matchedViaIdentifier && (gtin || mpn || googleShoppingId)) {
      identifierBackfills.push({
        productId:        existing.id,
        gtin:             gtin || null,
        mpn:              mpn || null,
        googleShoppingId: googleShoppingId || null,
      });
    }

    /* Step 2c: FTS match runs as a post-loop pass below — it needs
       network IO (RPC per deal) and we want all the in-memory
       lookups to settle first so we only spend the FTS budget on
       deals that legitimately need it. See the FTS pass after
       this loop closes. */

    if (existing?.id) {
      offerWrites.push({ deal: d, productId: existing.id });
      if (!existing.image_url && d.imageUrl) {
        imageBackfills.push({ productId: existing.id, imageUrl: d.imageUrl });
      }
    } else {
      newProducts.push({ deal: d, sigKey, canDedup });
    }
  }

  /* ── Step 2c: FTS dedup pass on newProducts ──────────────────────
     For each deal that fell through URL + signature + title_key
     match, try one more lookup via search_products_fts. This catches
     same-product-different-title across stores at INGEST time —
     before the row enters the catalog as a new product_id. Without
     this pass:
       slot.ng → "PRE-OWNED APPLE IPHONE 15 PRO MAX 256GB - SLOT"
                 ↓ FAILS signature (no canDedup on this title)
                 ↓ FAILS title_key (different from konga's title)
                 → INSERTS new product
       konga →   "Apple iPhone 15 Pro Max 256GB Black Titanium"
                 → already in catalog as product P1
       → Two product_ids for the SAME phone, never merged unless
         the offline cross-store dedup migration runs.

     With this pass, the slot.ng deal lands an FTS match against
     P1 (high title similarity, brand match, family match, price
     within band), reuses P1's product_id, and the spectrum bar
     immediately shows 2 stores.

     Budget guard: bounded to FTS_LOOKUP_BUDGET per ingest run so a
     thousand-deal run doesn't blow past the SerpAPI cron's 25-min
     wall time. Most cron runs upload 50-500 deals per provider call
     so the budget is generous in practice. Concurrency 8 keeps the
     RPC pipeline busy without overwhelming Postgres. */
  const FTS_LOOKUP_BUDGET = 300;
  if (newProducts.length > 0) {
    /* Only run FTS for "high-signal" new products — those with a
       parsed brand. Without a brand, the FTS gate downstream can't
       confidently confirm a match, so the call is wasted budget. */
    const ftsCandidates = newProducts
      .filter((np) => buildSignature(np.deal.title).brand !== null)
      .slice(0, FTS_LOOKUP_BUDGET);

    if (ftsCandidates.length > 0) {
      /* Bounded-concurrency map over the candidates. supa.rpc returns
         a Promise; running 8 in parallel keeps the RPC busy without
         starving the Postgres connection pool. */
      const CONCURRENCY = 8;
      const ftsResults = new Map<Deal, { id: string; image_url: string | null }>();
      for (let i = 0; i < ftsCandidates.length; i += CONCURRENCY) {
        const slice = ftsCandidates.slice(i, i + CONCURRENCY);
        await Promise.all(slice.map(async (np) => {
          const dealTitle = np.deal.title;
          const dealBrand = buildSignature(dealTitle).brand;
          const { data } = await supa.rpc("search_products_fts", {
            q: dealTitle,
            max_results: 5,
          });
          /* search_products_fts RETURNS product_id (not id) — that's
             the column name in the RPC's RETURNS TABLE definition.
             The first version of this code read top.id and ended up
             with undefined product_id on every FTS-matched offer,
             which broke ingest for Kara (user-reported May 2026:
             "null value in column product_id violates not-null
             constraint"). */
          const rows = (data ?? []) as Array<{ product_id: string; title: string; brand: string | null; image_url: string | null }>;
          if (rows.length === 0) return;
          /* STRICT same-product gate at ingest time:
             1. Top-result brand must match the incoming deal's brand.
                Without exact brand match the FTS hit is likely just
                a token overlap on a different product line.
             2. Top-result title must share most tokens with the
                incoming title. 70% normalised-token overlap is the
                threshold that empirically catches same-product
                rephrasings while rejecting "iPhone 15 case" vs
                "iPhone 15". */
          const top = rows[0];
          if (!top.product_id) return;
          if (!top.brand || !dealBrand) return;
          if (top.brand.toLowerCase() !== dealBrand.toLowerCase()) return;
          const tokensA = new Set(dealTitle.toLowerCase().match(/[a-z0-9]+/g) ?? []);
          const tokensB = new Set(top.title.toLowerCase().match(/[a-z0-9]+/g) ?? []);
          if (tokensA.size === 0 || tokensB.size === 0) return;
          let shared = 0;
          /* forEach iteration to satisfy the es2017 target without
             downlevelIteration (same pattern as the upsert helpers
             in this file). */
          tokensA.forEach((t) => { if (tokensB.has(t)) shared++; });
          const overlap = shared / Math.min(tokensA.size, tokensB.size);
          if (overlap < 0.7) return;
          ftsResults.set(np.deal, { id: top.product_id, image_url: top.image_url });
        }));
      }

      /* Promote matched FTS hits from newProducts → offerWrites,
         exactly like the in-loop existing-match path did. */
      if (ftsResults.size > 0) {
        const remaining: typeof newProducts = [];
        for (const np of newProducts) {
          const match = ftsResults.get(np.deal);
          if (match) {
            offerWrites.push({ deal: np.deal, productId: match.id });
            if (!match.image_url && np.deal.imageUrl) {
              imageBackfills.push({ productId: match.id, imageUrl: np.deal.imageUrl });
            }
          } else {
            remaining.push(np);
          }
        }
        const ftsMatched = newProducts.length - remaining.length;
        newProducts.length = 0;
        newProducts.push(...remaining);
        if (ftsMatched > 0) {
          console.log(`[ingest] FTS dedup matched ${ftsMatched} of ${ftsCandidates.length} candidates (saved ${ftsMatched} duplicate product rows).`);
        }
      }
    }
  }

  /* Step 3: bulk-insert new products with in-batch dedup.
     Two dedup buckets, applied in order:

       (a) sigKey  — when two canDedup=true deals share the same
                     signature, collapse into one row. Brand+model
                     parsed both sides; high-confidence merge.

       (b) titleKey — same-title deals collapse even when signature
                      didn't extract. Catches the cross-store same-
                      product case (Beats earphone cover ingested
                      from 5 stores at once → ONE products.id row,
                      not 5). Without this, a single ingest batch
                      could leak 4,810-style title duplicates that
                      the Step 2b lookup can't catch (because the
                      lookup runs once before the loop, so two new
                      deals with the same title in the same batch
                      both look "novel" to it and would otherwise
                      each insert a row).

     Both groups preserve the dedup semantic the per-deal loop had:
     first deal's INSERT populates products, subsequent deals' SELECT
     finds it. The batched version replicates that by grouping
     up-front. */
  if (newProducts.length > 0) {
    const insertList: Array<{ deal: Deal; sigKey: string }> = [];
    const groupIndexBySigKey   = new Map<string, number>();
    const groupIndexByTitleKey = new Map<string, number>();
    const dealToInsertIndex    = new Map<Deal, number>();

    for (const np of newProducts) {
      /* Bucket (a): high-confidence sigKey match. */
      if (np.canDedup && groupIndexBySigKey.has(np.sigKey)) {
        dealToInsertIndex.set(np.deal, groupIndexBySigKey.get(np.sigKey)!);
        continue;
      }
      /* Bucket (b): title_key match — same cleaned + normalized title,
         even without signature confidence. */
      const tk = normaliseTitleKey(cleanProductTitle(np.deal.title));
      if (tk.length > 0 && groupIndexByTitleKey.has(tk)) {
        dealToInsertIndex.set(np.deal, groupIndexByTitleKey.get(tk)!);
        continue;
      }
      const idx = insertList.length;
      insertList.push({ deal: np.deal, sigKey: np.sigKey });
      if (np.canDedup) groupIndexBySigKey.set(np.sigKey, idx);
      if (tk.length > 0) groupIndexByTitleKey.set(tk, idx);
      dealToInsertIndex.set(np.deal, idx);
    }

    const { data: inserted, error: insErr } = await supa
      .from("products")
      .insert(insertList.map(({ deal, sigKey }) => dealToProductRow(deal, sigKey)))
      .select("id");
    if (insErr || !inserted) {
      result.errors.push(`Bulk insert ${insertList.length} products: ${insErr?.message}`);
    } else {
      const insertedRows = inserted as Array<{ id: string }>;
      insertedProductIds.push(...insertedRows.map((r) => r.id));
      /* PostgREST INSERT...RETURNING preserves the VALUES-clause
         order, so index-based mapping is safe. Each deal's
         insert-index points at the corresponding inserted row. */
      for (const np of newProducts) {
        const idx = dealToInsertIndex.get(np.deal);
        if (idx === undefined) continue;
        const row = insertedRows[idx];
        if (row) offerWrites.push({ deal: np.deal, productId: row.id });
      }
    }
  }

  /* Step 4: bulk image backfills (rare — only when an existing
     product had a NULL image and the new deal provides one). */
  for (const b of imageBackfills) {
    /* These are still per-row UPDATEs because Postgres needs the
       conditional clause to match each row's id. Skipped on
       failure — backfill is opportunistic. */
    await supa.from("products").update({ image_url: b.imageUrl }).eq("id", b.productId);
  }

  /* Step 4b: identifier backfills — populate gtin/mpn/google_shopping_id
     on existing product rows that were matched via signature/title_key
     paths but didn't yet have the identifier the incoming deal carries.
     Uses COALESCE-style merge logic in JS (only writes the identifier
     when it's currently NULL on the row) — done by reading current
     value first. To keep this efficient on the common case, we batch
     identifier-distinct backfills and use a partial-unique-violation-
     safe write (skip on conflict, since gtin and gsh have UNIQUE
     constraints — if another row already claimed the identifier, we'd
     rather leave both rows alone than break the ingest).

     Performance: identifier backfills are rare (only fires when an
     existing product matched via signature/title_key AND the new
     deal carries a new identifier). After the first few weeks of
     ingest, most identified products have been backfilled and this
     loop is empty. */
  for (const b of identifierBackfills) {
    const patch: Record<string, string | null> = {};
    if (b.gtin)             patch.gtin = b.gtin;
    if (b.mpn)              patch.mpn = b.mpn;
    if (b.googleShoppingId) patch.google_shopping_id = b.googleShoppingId;
    if (Object.keys(patch).length === 0) continue;
    /* Best-effort: a partial-unique-violation here means another product
       row already owns this identifier (rare race condition or upstream
       provider returned the same identifier for different products).
       We intentionally swallow the error — the existing row keeps its
       state, the matched row keeps its state, no data loss. */
    const { error } = await supa.from("products").update(patch).eq("id", b.productId);
    if (error && !/duplicate key|unique constraint/i.test(error.message)) {
      result.errors.push(`Identifier backfill ${b.productId}: ${error.message}`);
    }
  }

  /* Step 5: bulk upsert offers.

     Before the upsert: capture which product_ids are about to lose
     their (store_id, url) anchor to a different product. The orphan
     check below (Step 5b) needs to know these so it can clean up
     the previous owners — see comment there.

     Step 4.5 — price-plausibility guard (added May 29 2026 after
     user reported "Lowest tracked $10 when current is $300" on PDP):
     drop any deal whose sale price falls below the priceLooksPlausible
     floor for its title + category. Catches the upstream leaks that
     produced bogus history rows — Shopify accessory-variant prices
     under flagship parent products, scrapers grabbing discount or
     unit-of-measure amounts, currency mis-detection writing raw USD
     as NGN. Same plausibility function used at FTS read time and
     /api/live-search filter, so an offer can't sneak past one
     surface and fail another.

     Drops are logged (not silent) so we notice if a real legit
     sub-floor deal gets rejected — that would be a flagship-floor
     map tuning issue we want to surface. */
  const USD_TO_NGN = 1_650;  // ingest plausibility floor; aligned with fx_rate() seed (0072) + utils.ts
  const refusedAsBogus: Array<{ title: string; storeId: string; ngn: number }> = [];
  const offerWritesPlausible: typeof offerWrites = [];
  for (const w of offerWrites) {
    const ngn = w.deal.currency === "USD"
      ? Math.round(w.deal.salePrice * USD_TO_NGN)
      : w.deal.salePrice;
    if (priceLooksPlausible(ngn, w.deal.categorySlug ?? null, w.deal.title)) {
      offerWritesPlausible.push(w);
    } else {
      refusedAsBogus.push({ title: w.deal.title, storeId: w.deal.storeId, ngn });
    }
  }
  if (refusedAsBogus.length > 0) {
    /* Capped log — avoid flooding the cron output when a misbehaving
       provider sends a thousand bogus rows in one wave. */
    const sample = refusedAsBogus.slice(0, 5).map((r) =>
      `${r.storeId}|${r.title.slice(0, 60)}|${r.ngn}NGN`
    ).join("; ");
    result.errors.push(
      `[ingest] refused ${refusedAsBogus.length} deals as below-floor (sample: ${sample}${refusedAsBogus.length > 5 ? "; ..." : ""})`,
    );
  }
  offerWrites.length = 0;
  offerWrites.push(...offerWritesPlausible);
  const offerRows = offerWrites.map(({ deal, productId }) =>
    dealToOfferRow(deal, productId, sourceProvider, sourceQuery, runStartedAt),
  );
  const displacedProductIds = new Set<string>();
  if (offerRows.length > 0) {
    const storeIds = Array.from(new Set(offerRows.map((r) => r.store_id)));
    const urls     = Array.from(new Set(offerRows.map((r) => r.url)));
    /* Two .in() filters AND-combine in PostgREST, so the result is a
       superset of the actual (store_id, url) tuples we care about —
       we narrow to exact tuple matches in the loop below. */
    /* Chunked probe — PostgREST URL cap ~8KB. PayPorte's 1,480-URL
       daily ingest blew past that limit. 100 URLs per chunk. Note:
       the previous single-shot version had a NULL-byte typo in the
       Map key template ("${o.store_id}\0${o.url}"), so even when the
       query succeeded the displaced lookup never matched anything. */
    const DISPLACED_URL_CHUNK_SIZE = 100;
    const existingMap = new Map<string, string>();
    let probeFailed = false;
    for (let i = 0; i < urls.length; i += DISPLACED_URL_CHUNK_SIZE) {
      const chunk = urls.slice(i, i + DISPLACED_URL_CHUNK_SIZE);
      const { data: existing, error: existingErr } = await supa
        .from("offers")
        .select("product_id, store_id, url")
        .in("store_id", storeIds)
        .in("url", chunk);
      if (existingErr) {
        result.errors.push(`Displaced-offer probe (chunk ${Math.floor(i / DISPLACED_URL_CHUNK_SIZE) + 1}): ${existingErr.message}`);
        probeFailed = true;
        break;
      }
      for (const o of (existing ?? []) as Array<{ product_id: string; store_id: string; url: string }>) {
        existingMap.set(`${o.store_id} ${o.url}`, o.product_id);
      }
    }
    if (!probeFailed) {
      for (const row of offerRows) {
        const prevPid = existingMap.get(`${row.store_id} ${row.url}`);
        if (prevPid && prevPid !== row.product_id) {
          displacedProductIds.add(prevPid);
        }
      }
    }

    const { error: offerErr } = await supa
      .from("offers")
      .upsert(offerRows, { onConflict: "store_id,url" });
    if (offerErr) {
      result.errors.push(`Bulk upsert ${offerWrites.length} offers: ${offerErr.message}`);
    } else {
      result.upserted = offerWrites.length;
    }
  }

  /* Step 5b: orphan reconciliation — the guard that makes ingestDeals
     orphan-proof. A product is only reachable if an offer points at
     it (product_best_offers inner-joins offers, so an offer-less
     product is invisible to every search surface). The split above
     (insert products, THEN upsert offers) has TWO windows where a
     product can be left with no offer:

       1. INSERTED-RUN ORPHANS — the offer upsert is keyed on
          (store_id, url). If a concurrent run already wrote that
          offer, this run's upsert UPDATEs the existing row and
          re-points it — the product we just inserted gets nothing.
          A partial offer-upsert failure has the same effect.

       2. DISPLACED PRE-EXISTING ORPHANS (May 2026 fix) — when the
          upsert re-points an existing (store_id, url) offer onto a
          NEW product_id, the previous owner of that offer loses its
          one and only anchor and becomes a permanent orphan unless
          it has other offers. The original orphan-reconciliation
          only checked insertedProductIds — completely missing this
          path, so every PayPorte/3CHub re-ingest where a product's
          signature drifted created an orphan version that piled up
          forever (audit found 2,940 such products = 16.7% of catalog
          on May 28, 2026, all created in the last month — exactly
          the daily-Shopify-JSON ingest pattern).

     The fix: take the union of insertedProductIds AND
     displacedProductIds; query offers for ALL of them; delete any
     whose offer count came out zero. A pre-existing product with
     OTHER offers (not just the displaced one) is safely retained
     because the post-upsert offer probe still finds those. */
  /* Union via Set then materialise as Array — keeps both sources
     deduped if a product was both inserted this run AND displaced. */
  const candidateOrphanSet = new Set<string>(insertedProductIds);
  displacedProductIds.forEach((id) => candidateOrphanSet.add(id));
  const candidateOrphanIds = Array.from(candidateOrphanSet);
  if (candidateOrphanIds.length > 0) {
    /* Chunked probe — UUIDs are 36 chars each; 1,480 candidates is
       ~55KB of inline IN values, over the PostgREST 8KB URL cap.
       200 IDs per chunk = ~8KB query, leaves headroom. */
    const ORPHAN_PROBE_CHUNK = 200;
    const haveOffer = new Set<string>();
    let probeFailed = false;
    for (let i = 0; i < candidateOrphanIds.length; i += ORPHAN_PROBE_CHUNK) {
      const chunk = candidateOrphanIds.slice(i, i + ORPHAN_PROBE_CHUNK);
      const { data: withOffers, error: probeErr } = await supa
        .from("offers")
        .select("product_id")
        .in("product_id", chunk);
      if (probeErr) {
        result.errors.push(`Orphan-reconciliation probe (chunk ${Math.floor(i / ORPHAN_PROBE_CHUNK) + 1}): ${probeErr.message}`);
        probeFailed = true;
        break;
      }
      for (const r of (withOffers ?? []) as Array<{ product_id: string }>) {
        haveOffer.add(r.product_id);
      }
    }
    if (!probeFailed) {
      const orphanIds = candidateOrphanIds.filter((id) => !haveOffer.has(id));
      if (orphanIds.length > 0) {
        /* Chunked delete — same PostgREST URL-cap issue as the probe.
           200 IDs per chunk = ~8KB query. May 28 2026 test of the
           PayPorte daily ingest had 1,480 candidates and got "Bad
           Request" on the single-shot delete. */
        /* Chunked delete — adding .select("id") so we get back the
           actual deleted rows (not just success). The May 28 2026
           probe found that the DB trigger reap_orphaned_product_trigger
           fires on offer UPDATE before this code runs, so by the time
           we get here the displaced products are already deleted. The
           previous version reported `chunk.length` as deleted (a lie —
           Supabase returned success even when 0 rows matched), making
           the log misleading. Now logs the TRUE delete count returned
           by the API. */
        const ORPHAN_DELETE_CHUNK = 200;
        let actuallyDeleted = 0;
        let delFailed = false;
        for (let i = 0; i < orphanIds.length; i += ORPHAN_DELETE_CHUNK) {
          const chunk = orphanIds.slice(i, i + ORPHAN_DELETE_CHUNK);
          const { data: delData, error: delErr } = await supa.from("products").delete().in("id", chunk).select("id");
          if (delErr) {
            result.errors.push(`Orphan reconciliation delete (chunk ${Math.floor(i / ORPHAN_DELETE_CHUNK) + 1}, ${chunk.length} ids): ${delErr.message}`);
            delFailed = true;
            break;
          }
          actuallyDeleted += delData?.length ?? 0;
        }
        if (!delFailed && actuallyDeleted > 0) {
          const insertedCount  = orphanIds.filter((id) => insertedProductIds.includes(id)).length;
          const displacedCount = orphanIds.length - insertedCount;
          console.log(
            `[ingest] orphan reconciliation: deleted ${actuallyDeleted} of ${orphanIds.length} candidate orphan(s) ` +
            `(${insertedCount} from this run + ${displacedCount} pre-existing; remainder already reaped by DB trigger).`,
          );
        } else if (!delFailed && actuallyDeleted === 0 && orphanIds.length > 0) {
          /* Healthy state — the DB trigger handled every displaced
             product before we got to this reconciliation step. */
          console.log(`[ingest] orphan reconciliation: ${orphanIds.length} candidate(s) flagged, all already reaped by DB trigger.`);
        } else if (delFailed && actuallyDeleted > 0) {
          console.log(`[ingest] orphan reconciliation: partial — deleted ${actuallyDeleted} before failure.`);
        }
      }
    }
  }

  // 3a. Full-catalog sweep — only when the caller asserts scope.
  //     Aggressive: marks every offer in the store NOT seen this run.
  if (options.sweepScope?.store) {
    await sweepStaleOffers(supa, {
      storeId: options.sweepScope.store,
      runStartedAt,
      batchSize: result.upserted,
      result,
    });
  }

  /* 3b. TTL sweep — runs on EVERY ingest path regardless of source.
        Conservative: marks offers whose `last_seen_at` is older than
        TTL_DAYS for stores we touched THIS run. Catches the gap that
        per-category SerpAPI / per-SKU UK retailer / curated ingest
        used to leave open: their offers had no sweep wired in, so
        delisted SKUs sat in_stock=true forever.

        Why per-store and not catalog-wide: a UK retailer ingest
        run shouldn't accidentally touch Konga rows — only the
        stores actually present in `deals` get swept. The cron
        `npx tsx scripts/sweep-stale-offers.ts --apply` covers
        whole-catalog cleanup for stores that nothing's ingesting.

        Conservative threshold (30 days) so a normal scrape cadence
        miss doesn't trigger false flips; the per-store sweep above
        handles fast-moving full catalogs. */
  if (result.upserted > 0) {
    const touchedStores = Array.from(new Set(deals.map((d) => d.storeId).filter(Boolean)));
    /* Skip stores already covered by the full-catalog sweep above
       (it ran a more aggressive flip already; the TTL pass would
       be a no-op anyway). */
    const sweepedAlready = options.sweepScope?.store ? new Set([options.sweepScope.store]) : new Set<string>();
    const stores = touchedStores.filter((s) => !sweepedAlready.has(s));
    if (stores.length > 0) {
      await ttlSweepForStores(supa, stores, runStartedAt, result);
    }
  }

  // 4. Close the run record
  await supa
    .from("ingestion_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.errors.length === 0 ? "success" : (result.upserted > 0 ? "partial" : "error"),
      items_fetched: result.fetched,
      items_upserted: result.upserted,
      errors: result.errors.length > 0 ? result.errors : null,
    })
    .eq("id", run.id);

  return result;
}

/* ── Staleness sweep ──────────────────────────────────────────────── */

interface SweepParams {
  storeId:       string;
  runStartedAt:  string;
  /** How many offers the run successfully upserted. Used as a sanity
      guard against partially-broken scrapes. */
  batchSize:     number;
  /** Mutated to record the outcome of the sweep (count flipped,
      reasons skipped, etc.) on result.errors when relevant. */
  result:        IngestResult;
}

/**
 * Mark offers belonging to `storeId` that were NOT touched in this
 * run as in_stock=false. The product_best_offers view filters
 * in_stock=true, so flipped offers immediately drop out of /deals
 * and the per-product price comparisons without us deleting any
 * rows (historical data preserved for audit).
 *
 * Guards (skips sweep + logs a warning, no errors raised):
 *   1. batchSize < MIN_DEALS_FOR_SWEEP — almost certainly a broken
 *      scrape, not a real "merchant has 9 products" catalog.
 *   2. batchSize < MIN_BATCH_FRACTION_OF_EXISTING × current in-stock
 *      count — a >60% drop in catalog size is much more likely a
 *      scraper regression than mass delisting.
 */
async function sweepStaleOffers(
  supa:   NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  params: SweepParams,
): Promise<void> {
  const { storeId, runStartedAt, batchSize, result } = params;

  if (batchSize < MIN_DEALS_FOR_SWEEP) {
    console.warn(
      `[ingest] sweep skipped for ${storeId}: only ${batchSize} deals upserted (< ${MIN_DEALS_FOR_SWEEP}). Looks like a broken scrape - leaving existing offers untouched.`,
    );
    return;
  }

  /* Compare the new batch size to the store's CURRENT in-stock
     offer count. If we're seeing a giant drop, abort the sweep —
     way more likely the scraper broke than the merchant lost 80%
     of their catalog overnight. */
  const { count: existingCount, error: countErr } = await supa
    .from("offers")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("in_stock", true);

  if (countErr) {
    /* If we can't read the count, fail open — don't sweep, log it.
       Better to leave a stale row in for one cycle than risk nuking
       a healthy catalog on a transient PostgREST hiccup. */
    console.warn(
      `[ingest] sweep skipped for ${storeId}: count probe failed (${countErr.message}). Will retry next run.`,
    );
    return;
  }

  if (existingCount && batchSize < existingCount * MIN_BATCH_FRACTION_OF_EXISTING) {
    console.warn(
      `[ingest] sweep skipped for ${storeId}: batch (${batchSize}) is < ${Math.round(MIN_BATCH_FRACTION_OF_EXISTING * 100)}% of existing in-stock (${existingCount}). Looks like a partial scrape - leaving existing offers untouched.`,
    );
    return;
  }

  /* All checks passed — run the sweep. Single statement, indexed by
     (store_id, last_seen_at). Returns the affected rows via a
     count=exact hint so we can log how many vanished. */
  const { data: flipped, error: sweepErr } = await supa
    .from("offers")
    .update({ in_stock: false })
    .eq("store_id", storeId)
    .eq("in_stock", true)
    .lt("last_seen_at", runStartedAt)
    .select("id");

  if (sweepErr) {
    result.errors.push(`Staleness sweep for ${storeId}: ${sweepErr.message}`);
    return;
  }

  const flippedCount = flipped?.length ?? 0;
  if (flippedCount > 0) {
    console.log(
      `[ingest] sweep ${storeId}: ${flippedCount} offer(s) marked out-of-stock (not seen in run starting ${runStartedAt}).`,
    );
  }
}

/* ── TTL sweep for partial-scope ingest paths ────────────────────── */

/** Days before a non-touched offer (per touched-store) gets flipped
    to in_stock=false by the auto-TTL pass. Conservative — should be
    much longer than the typical scrape cadence so a single missed
    run can't nuke an active catalogue. The whole-catalog cron
    (scripts/sweep-stale-offers.ts) covers stores nothing's
    ingesting. */
/* Lowered May 29 2026 from 30 to 14 days after a user trust-break
   report ("Last refreshed 2w ago, merchant price had changed").

   Mon+Thu scrape cadence means ~6 cycles in 14 days; if SIX
   consecutive cycles fail to re-verify an offer, the offer is almost
   certainly gone from the merchant feed (Shopify catalog change,
   SerpAPI query no longer running, store removed the listing). A
   transient scraper outage usually clears within 1-2 cycles, so 14
   days is well past the noise threshold while still aggressive
   enough that stale data doesn't accumulate.

   Combined with the staleness warning chip on ProductHero (b4f5a0e)
   the user-facing experience now is:
     fresh        (< 7 days)   normal PDP
     aging         (7-14 days) amber "price may have changed" chip
     stale flip   (>= 14 days) offer flipped in_stock=false ->
                                 spectrum shows OUT OF STOCK ->
                                 PDP becomes noindex (existing logic) ->
                                 Google stops surfacing in results ->
                                 alternatives rail surfaces cheaper picks */
const TTL_DAYS = 14;

/**
 * Per-store TTL sweep. For each store the caller touched in this
 * run, flip offers older than TTL_DAYS to in_stock=false.
 *
 * Single SQL UPDATE per store. No per-row guard like the full-catalog
 * sweep — TTL is conservative enough (30 days) that we trust it
 * regardless of batch size. SerpAPI / UK retailer / curated ingest
 * paths all benefit automatically; they don't need to know about it.
 */
async function ttlSweepForStores(
  supa:         NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  storeIds:     string[],
  runStartedAt: string,
  result:       IngestResult,
): Promise<void> {
  const threshold = new Date(
    new Date(runStartedAt).getTime() - TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  let totalFlipped = 0;
  for (const storeId of storeIds) {
    const { data: flipped, error: sweepErr } = await supa
      .from("offers")
      .update({ in_stock: false })
      .eq("store_id", storeId)
      .eq("in_stock", true)
      .lt("last_seen_at", threshold)
      .select("id");
    if (sweepErr) {
      result.errors.push(`TTL sweep for ${storeId}: ${sweepErr.message}`);
      continue;
    }
    const n = flipped?.length ?? 0;
    if (n > 0) {
      totalFlipped += n;
      console.log(
        `[ingest] TTL sweep ${storeId}: ${n} offer(s) older than ${TTL_DAYS}d marked out-of-stock.`,
      );
    }
  }
  if (totalFlipped > 0) {
    console.log(`[ingest] TTL sweep total: ${totalFlipped} offers across ${storeIds.length} stores.`);
  }
}
