import { NextRequest, NextResponse } from "next/server";
import { searchByKey } from "@/lib/search";
import { pgFtsFindSimilar, pgFtsFindByProductId, pgFtsFindDupes } from "@/lib/search/pg-fts";
import { partitionDupesByVariantMatch, variantOffers } from "@/lib/search/variant-pooling";
import { getServerCountry } from "@/lib/country-server";
import { isOfferAllowedForCountry } from "@/lib/country";
import { fetchOfferById, type OfferRow } from "@/lib/offers/fetch-offer-by-id";
import { usdToNgn } from "@/lib/utils";
import type { SearchOutput, ProductGroup, DupeResult, StoreOffer } from "@/lib/search";

/* Phase 6e — pg-fts is the only engine for /compare's text search.
   The old heuristic engine (BRANDS list, PRODUCT_TYPES regex, etc.)
   has been deleted. URLs that hit this route directly without prior
   sniffing fall through to pg-fts (which won't FTS-match them) → the
   UI's live SerpAPI section takes over. */

const headers = { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" };

/* ── oid fallback — synthesize a single-offer anchor from an
   OfferRow when pid + FTS both miss.

   Use case: the user came from a PDP that successfully rendered
   the product (via the same 3-source fetchOfferById path) and
   clicked "Compare prices across N stores". Without this
   fallback, products with a synthetic-id pid (curated Amazon
   slugs) or weak FTS matches landed on "Nothing found" even
   though the PDP could clearly resolve them — broken click-
   through promise.

   The synthesis:
     1. Build a StoreOffer in the dupes-pipeline shape from the
        OfferRow. Currency normalisation routes through usdToNgn
        so the rest of the pipeline can mix NGN + USD anchors
        cleanly.
     2. Wrap as a single-offer ProductGroup anchor.
     3. Run pgFtsFindDupes against the title to populate the
        "Cheaper alternatives" rail.
     4. Apply the variant-pooling partition so same-product
        listings from other stores fold into the anchor's offers
        rather than the dupes rail — matches what
        pgFtsFindByProductId does for DB-resolved anchors. */
function offerRowToStoreOffer(row: OfferRow): StoreOffer {
  const priceNgn    = row.currency === "USD" ? usdToNgn(row.current_price) : row.current_price;
  const originalNgn = row.original_price
    ? (row.currency === "USD" ? usdToNgn(row.original_price) : row.original_price)
    : priceNgn;
  /* Match the ingest's landed-cost heuristic: ~30% adder for
     international stores (USD-priced) so the spectrum's
     effective-price math agrees with the DB-anchored path. */
  const landedExtra = row.is_international ? Math.round(priceNgn * 0.30) : 0;
  const discountPct = row.discount_percent ?? 0;
  return {
    offerId:         row.offer_id,
    storeId:         row.store_id,
    storeName:       row.store_name,
    storeLogoUrl:    row.store_logo_url ?? `/logos/${row.store_id}.png`,
    storeColor:     "#000",
    price:           priceNgn,
    currency:        "NGN",
    url:             row.url,
    imageUrl:        row.image_url ?? undefined,
    productTitle:    row.title,
    originalPrice:   originalNgn,
    discountPercent: discountPct,
    rating:          0,
    deliveryDays:    row.is_international ? 14 : 3,
    isInternational: row.is_international,
    landedCostExtra: landedExtra,
    landedPrice:     priceNgn + landedExtra,
  };
}

async function synthesizeAnchorFromOfferRow(row: OfferRow): Promise<SearchOutput> {
  const visitingOffer = offerRowToStoreOffer(row);

  /* Find similar products via FTS — same pipeline the PDP uses. */
  const dupes = await pgFtsFindDupes(row.title, 0, { limit: 16 });

  /* Partition: same-product variants fold into the anchor's
     offers; truly different products stay in the rail. Mirrors
     pgFtsFindByProductId so /compare's anchor count is consistent
     between DB-resolved and synthesised paths. */
  const partition = partitionDupesByVariantMatch(
    { title: row.title, brand: row.brand, priceNgn: visitingOffer.landedPrice },
    dupes,
  );
  const augmentedOffers = [visitingOffer, ...variantOffers(partition.likelyVariants)];

  const anchor: ProductGroup = {
    key:           row.product_id || row.offer_id,
    title:         row.title,
    category:      row.category_slug ?? "general",
    imageUrl:      row.image_url ?? undefined,
    imageEmoji:    "🛍️",
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    brand:         row.brand,
    model:         null,
    storageGb:     null,
    inches:        null,
    storeCount:    augmentedOffers.length,
    bestPrice:     augmentedOffers.length > 0 ? Math.min(...augmentedOffers.map((o) => o.landedPrice)) : visitingOffer.landedPrice,
    worstPrice:    augmentedOffers.length > 0 ? Math.max(...augmentedOffers.map((o) => o.landedPrice)) : visitingOffer.landedPrice,
    maxSavings:    0,
    offers:        augmentedOffers,
  };

  return {
    mode:   "similar",
    query:  row.title,
    anchor,
    dupes:  partition.otherProducts,
  };
}

/* For non-NG users, drop NG-anchored offers from anchor + dupes.
   Returns mode:"empty" if filtering wipes the anchor (UI then falls
   back to live-search results which are also country-filtered). */
function filterByCountry(
  out: SearchOutput,
  country: ReturnType<typeof getServerCountry>,
): SearchOutput {
  if (out.mode === "empty") return out;

  function pruneOffers<T extends ProductGroup | DupeResult>(g: T): T | null {
    const offers = g.offers.filter((o) => isOfferAllowedForCountry(o, country));
    if (offers.length === 0) return null;
    return { ...g, offers, storeCount: offers.length };
  }

  if (out.mode === "single") {
    const g = pruneOffers(out.group);
    if (!g) return { mode: "empty", query: out.query, suggestions: [] };
    const alternatives = out.alternatives
      .map(pruneOffers)
      .filter((a): a is ProductGroup => a !== null);
    return { mode: "single", query: out.query, group: g, alternatives };
  }

  if (out.mode === "similar") {
    const anchor = pruneOffers(out.anchor);
    if (!anchor) return { mode: "empty", query: out.query, suggestions: [] };
    const dupes = out.dupes
      .map(pruneOffers)
      .filter((d): d is DupeResult => d !== null);
    return { mode: "similar", query: out.query, anchor, dupes };
  }

  return out;
}

export async function GET(req: NextRequest) {
  const q   = req.nextUrl.searchParams.get("q")   ?? "";
  const key = req.nextUrl.searchParams.get("key") ?? "";
  /* Round-4 QA: chip clicks pass `?pid=<product_id>` as a backstop
     so FTS-flakiness or catalog shift can't surface "Nothing in our
     local index" for a product the chip pool just promised was
     comparable across 2+ stores. If the FTS query path returns
     empty AND we have a pid, fall through to direct DB lookup. */
  const pid = req.nextUrl.searchParams.get("pid") ?? "";
  /* `oid` — offer-id backstop for the PDP "Compare prices across
     N stores" CTA. When pid + FTS both miss (synthetic-id PDPs,
     unusual titles, country-filter wipe-outs), the oid lets us
     fetch the offer from the SAME 3-source resolver the PDP
     uses and synthesise a single-offer anchor + dupes. Guarantees
     that anything visible on the PDP renders something useful
     on /compare. */
  const oid = req.nextUrl.searchParams.get("oid") ?? "";

  // Key-based direct lookup (legacy /compare?key= URLs)
  if (key) {
    return NextResponse.json(searchByKey(key), { headers });
  }

  if (!q.trim() && !pid && !oid) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const country = getServerCountry();

    /* Resolution priority — pid first when present.

       When pid is in the URL the user has explicitly clicked a
       specific product (PDP "Compare prices" CTA, chip click, etc.).
       That's an EXPLICIT signal — much stronger than FTS-on-title
       which is a guess. Use the pid to anchor the comparison
       directly; only fall through to FTS when pid lookup misses
       (catalog shift between chip generation and click).

       Why this ordering matters: FTS scoring on noisy/short titles
       can pick the wrong anchor by latching onto a single shared
       token. User report May 2026: searching "Hank Luxury -
       Bluetooth Key & Item Finder For Smartp" with the correct pid
       in the URL returned "Burgundy Luxury Shoe For Men" as anchor
       (FTS matched on the "luxury" token + the actual Hank Luxury
       product was lower-ranked in FTS results, so the pid backstop
       never fired because FTS was non-empty). Pid-first eliminates
       this whole class of bug.

       FTS still runs as the fallback for queries that arrive
       WITHOUT a pid (homepage search, paste-a-link results, manual
       /compare?q= URL entry).

       Control flow simplified May 2026: the prior version mixed
       `result!` non-null asserts with operator-precedence-dependent
       conditions that were correct but fragile. Now: explicit null
       state, two well-named branches, single empty fallback. */
    let result: SearchOutput | null = null;
    if (pid) {
      result = await pgFtsFindByProductId(pid);
    }
    const pidMissedOrAbsent = !result || result.mode === "empty";
    if (pidMissedOrAbsent && q.trim()) {
      result = await pgFtsFindSimilar(q);
    }
    if (!result) {
      result = { mode: "empty", query: q, suggestions: [] };
    }

    /* Auto-pivot (May 2026): when FTS returned empty AND a
       suggestion looks like a clean fused / split variant of the
       query (e.g. "lawn mower" → "Mac Allister Lawnmower"), retry
       the search with the suggested title automatically. User sees
       real results instead of a "Did you mean..." pill they have
       to click. Original query preserved in `pivotedFromQuery` so
       the UI can render a "Showing results for X · Search for
       {original} instead" notice.

       Why substring-of-stripped, not score threshold:
       Trigram scores for short queries against long titles are
       naturally low (0.20-0.30 typical, even for clear matches).
       Setting a high score threshold (0.45+) misses obvious
       fuse/split cases. Setting a low threshold (0.20) false-
       positives on weak typo-like overlaps ("lawn mower" → "moto
       g57 power" scored 0.238 in the suggest_titles probe).

       Substring containment is the right signal: if the stripped
       title contains the stripped query verbatim, the suggestion
       is the same word(s) the user typed, just with or without
       spaces. Examples:
         - "lawn mower"   → "macallister1800wcordedpushlawnmower" ✓ contains "lawnmower"
         - "play station" → "playstation5console"                  ✓ contains "playstation"
         - "lawn mower"   → "motog57power"                          ✗ doesn't contain "lawnmower"
         - "iphn"         → "iphone15promax"                        ✗ doesn't contain "iphn"
           (correct: leaves user with the Did You Mean pill so they
            confirm the typo correction consciously). */
    if (q.trim() && result.mode === "empty" && result.suggestions.length > 0) {
      const stripped = q.replace(/\s+/g, "").toLowerCase();
      const queryLc = q.toLowerCase().trim();
      const pivot = result.suggestions.find((s) => {
        const titleStripped = s.title.replace(/\s+/g, "").toLowerCase();
        return s.title.toLowerCase().trim() !== queryLc
            && titleStripped.includes(stripped);
      });
      if (pivot) {
        const pivoted = await pgFtsFindSimilar(pivot.title);
        if (pivoted.mode !== "empty") {
          result = { ...pivoted, query: pivot.title, pivotedFromQuery: q } as SearchOutput & { pivotedFromQuery?: string };
        }
      }
    }

    /* (Pid resolution moved ABOVE the FTS path — see comment near
       the top of this try block. The pid-as-fallback pattern that
       used to live here is now pid-as-primary.) */
    const filtered = country.code === "ng" ? result : filterByCountry(result, country);

    /* oid fallback — the ultimate backstop. When pid + FTS + country
       filter all leave us empty, but the user came from a PDP that
       can clearly resolve the product, fetch the offer directly and
       synthesise a single-offer anchor. This catches:
         - Synthetic product_ids (curated Amazon) where pid lookup
           fails the uuid type cast.
         - Products whose title doesn't FTS-match enough to pick
           an anchor.
         - Products whose only offers were country-filtered out
           (rare, but possible for edge-case retailers).
       The synthesis runs pgFtsFindDupes + variant pooling, so the
       resulting page still shows variants + cheaper alternatives
       beneath the anchor. */
    if (filtered.mode === "empty" && oid) {
      const offerRow = await fetchOfferById(oid);
      if (offerRow) {
        const synthesised = await synthesizeAnchorFromOfferRow(offerRow);
        const synthFiltered = country.code === "ng"
          ? synthesised
          : filterByCountry(synthesised, country);
        /* Country filter might wipe the synthesised anchor too
           (e.g. NG-anchored store, UK visitor). In that case keep
           the original empty result so the empty-state UI renders
           sensibly. */
        if (synthFiltered.mode === "similar") {
          return NextResponse.json(synthFiltered, { headers });
        }
      }
    }

    return NextResponse.json(filtered, { headers });
  } catch (err) {
    console.error("[/api/compare]", err);
    return NextResponse.json(
      { mode: "empty", query: q, suggestions: [] },
      { headers },
    );
  }
}
