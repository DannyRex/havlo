/* Variant-aware spectrum pooling.

   The PriceComparisonBar's "across N stores" signal originally read
   only from the anchor product's offers (this product_id) plus
   signature-tight siblings (signature = brand|model both parsed).
   That guard is right for the strict case ("same SKU at multiple
   stores") but it collapses to "1 store · watching for more" for a
   huge tail of products where ingest-time brand/model parsing
   misses — Stanley Quencher tumblers, Apple-line products with
   non-canonical titles, fashion items, etc.

   This module bridges the gap. After the dupes engine returns
   similar products via FTS over the title, we partition them into:
     • likelyVariants — same brand + family + variant + size +
       model tokens + within reasonable price band. These are
       "the same product at another store" for spectrum purposes.
     • otherProducts — broader similarity but a real-product
       difference (different size, different generation, different
       sub-model). These stay in the "You may also like" rail.

   The variant offers get folded into the spectrum's anchor pool
   so the bar plots ALL of them as dots and the "Compare prices
   across N stores" CTA reflects real comparison breadth.

   Pure JS — no DB calls. The dupes engine has already done the
   FTS work; this just classifies the results. */

import type { DupeResult, StoreOffer } from "@/lib/search";
import {
  isLikelySameProduct,
  extractRequiredNumbers,
  extractRequiredModelTokens,
  extractVariantTokens,
  extractQueryBrand,
  candidateHasBrand,
} from "./query-understanding";

export interface PartitionResult {
  /** Dupes that look like genuine same-product variants — their
      offers should be merged into the spectrum's anchor pool. */
  likelyVariants: DupeResult[];
  /** Dupes that share brand+model-prefix with the anchor but are
      different sub-tier SKUs (iPhone 15 → iPhone 15 Plus, Galaxy
      S24 → S24 Ultra, MacBook Pro M3 → M4). These render in their
      own "Other models in this line" rail — not pooled into the
      spectrum, not mixed into cross-brand alternatives. */
  siblingVariants: DupeResult[];
  /** Dupes from a different brand or model line entirely — true
      cross-brand alternatives that earned their place in the
      "You may also like / Cheaper alternatives" rail. */
  otherProducts: DupeResult[];
}

export function partitionDupesByVariantMatch(
  anchor: { title: string; brand: string | null; priceNgn: number; family?: string | null },
  dupes: DupeResult[],
): PartitionResult {
  const likelyVariants: DupeResult[] = [];
  const siblingVariants: DupeResult[] = [];
  const otherProducts: DupeResult[] = [];

  /* Sibling detection — narrowly scoped to the EXACT case the QA
     report caught: iPhone 15 anchor showing iPhone 15 Plus as a
     "cheaper alternative". A sibling is the SAME generation/model
     number with a DIFFERENT sub-tier suffix (Plus, Pro, Max, Ultra,
     Mini, SE, FE, etc.).

     First implementation was way too broad — any 2-word slice match
     on brand+model-prefix flagged every iPhone as a sibling of every
     other iPhone, every Nike Air as a sibling of every other Nike
     Air. Result: the "You may also like" rail went near-empty
     because legit alternatives (iPhone 14, Galaxy S23, etc.) got
     swept up.

     Tightened rule (May 2026 v2): a dupe is a sibling iff
       (a) brand matches exactly
       (b) shares ALL numeric model markers with the anchor
           (iPhone 15 vs iPhone 15 Plus share "15"; iPhone 14 vs
           iPhone 15 do NOT share — 14 is in one, 15 in the other)
       (c) shares ALL letter-glued model tokens (s24 + s24 ultra
           share "s24"; xm4 vs xm5 do NOT)
       (d) ONE side has additional sub-tier variant tokens (plus,
           pro, max, ultra, mini, se, fe, etc.) that the other
           lacks — this is what makes them siblings rather than
           the exact same SKU
     Without (d) it would just be a same-product match and the
     variant gate would have already pooled them into the spectrum. */
  const anchorBrand = (anchor.brand ?? "").toLowerCase().trim();
  const anchorNumbers = extractRequiredNumbers(anchor.title);
  const anchorModels  = extractRequiredModelTokens(anchor.title);
  const anchorVariants = extractVariantTokens(anchor.title);

  /* Fashion/beauty brand gate (June 2026). In apparel + cosmetics the brand IS
     the discriminator (no model/numeric markers), and luxury knockoff spam
     reuses one dropship photo + title template under many brand names ("Tommy
     Hilfiger ... Track Jacket" vs "GG / Amiri ... Track Jacket"). The shallow
     gate only rejects on a RECOGNISED brand mismatch, so a brand-LESS knockoff
     ("GG", "Amiri" — not in the brand dictionary) with a near-identical title
     slips into the spectrum, over-counting the PDP "Compare prices across N
     stores" against the correctly brand-gated /compare path. Require the
     candidate to carry the anchor's brand before it can be a same-product
     variant -- mirrors the /compare pid path's candidateHasBrand filter so the
     two surfaces agree. Gated to fashion/beauty (category_slug) so an
     electronics match whose brand-name differs from its line-name ("Apple" vs
     an "iPhone 15" title) is never dropped. */
  const fam = (anchor.family ?? "").toLowerCase();
  const fashionBrandGate = (fam === "fashion" || fam === "beauty")
    && !!(anchorBrand || extractQueryBrand(anchor.title));
  const anchorBrandForGate = anchorBrand || extractQueryBrand(anchor.title);

  function looksLikeSibling(d: DupeResult): boolean {
    const dBrand = (d.brand ?? "").toLowerCase().trim();
    if (!anchorBrand || !dBrand || anchorBrand !== dBrand) return false;

    const dTitleLc = d.title.toLowerCase();
    /* (b) all anchor numeric model markers must appear in dupe.
       Catches iPhone 15 / 15 Plus (both have "15") but rejects
       iPhone 14 vs iPhone 15. */
    for (const n of anchorNumbers) {
      if (!dTitleLc.includes(n)) return false;
    }
    /* (c) all anchor letter-glued model tokens must appear.
       Catches s24 / s24 Ultra (both share "s24") but rejects
       WH-1000XM4 vs WH-1000XM5. */
    for (const m of anchorModels) {
      if (!dTitleLc.includes(m)) return false;
    }
    /* (d) variant token asymmetry — one side has a sub-tier
       suffix the other doesn't. If both sides have identical
       variant tokens (or both have none) it's not a sibling —
       it would be the same SKU (caught by the variant gate)
       or a same-tier different-product (cross-brand-ish). */
    const dVariants = extractVariantTokens(d.title);
    const anchorSet = new Set(anchorVariants);
    const dSet = new Set(dVariants);
    const anchorHasUnique = anchorVariants.some((v) => !dSet.has(v));
    const dHasUnique      = dVariants.some((v) => !anchorSet.has(v));
    return anchorHasUnique || dHasUnique;
  }

  for (const d of dupes) {
    /* anchor.family lets the caller pass an authoritative product
       family (from category_slug) so detection inside the gate
       isn't repeated for every dupe. When omitted, the gate
       falls back to detecting family from the anchor title. */
    const isVariant = (!fashionBrandGate || candidateHasBrand(d.title, anchorBrandForGate))
      && isLikelySameProduct(
        { title: anchor.title, brand: anchor.brand, priceNgn: anchor.priceNgn, family: anchor.family ?? null },
        { title: d.title,      brand: d.brand,      priceNgn: d.bestPrice },
      );
    if (isVariant) {
      likelyVariants.push(d);
    } else if (looksLikeSibling(d)) {
      /* Same brand, same model line, but failed the strict gate —
         this is iPhone 15 Plus to anchor iPhone 15, or S24 Ultra
         to anchor S24. Belongs in the "Other models" rail, not
         mixed with cross-brand alternatives. */
      siblingVariants.push(d);
    } else {
      otherProducts.push(d);
    }
  }

  return { likelyVariants, siblingVariants, otherProducts };
}

/* Flatten variant DupeResults into a single StoreOffer[] suitable
   for merging into the anchor pool. Each variant carries its OWN
   per-store offers (a single dupe can have multiple stores when
   FTS pooling found the same variant across retailers).

   PRESERVES productTitle: each augmented offer is stamped with the
   variant product's actual title (not the anchor's) so downstream
   consumers — CompareAnchorCard's per-row "as titled at this store"
   subtitle, click-through routing, debugging — can tell which
   underlying product an offer really belongs to. Without this,
   sibling-variant offers inherited the anchor's title at render
   time and a user could click an offer expecting the anchor product
   but land on a different one (May 2026 report: Nike Club Swoosh
   cap anchor had a Nike Club shorts offer attached because the
   variant gate let it through, and the /compare card showed no
   indication that the offer was for a different product). The gate
   itself has been tightened in query-understanding.ts; this is the
   belt-and-braces complement so even a future loosening can't
   mislead the UI. */
export function variantOffers(variants: DupeResult[]): StoreOffer[] {
  return variants.flatMap((v) =>
    v.offers.map((o) => ({
      ...o,
      productTitle: o.productTitle ?? v.title,
    })),
  );
}
