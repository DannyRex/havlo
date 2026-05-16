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
import { isLikelySameProduct } from "./query-understanding";

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

  /* Anchor's identity tokens — used to detect siblings. A sibling
     shares the brand AND a meaningful piece of the model identifier
     (the leading model token like "iphone 15", "galaxy s24") but
     fails the strict same-product gate because it carries different
     variant/number/model tokens (Plus, Ultra, Max, M4 vs M3, etc.).

     We compute these from the anchor's title once and reuse per dupe. */
  const anchorBrand = (anchor.brand ?? "").toLowerCase().trim();
  /* Model prefix: first 2-3 alphanumeric tokens of the anchor title,
     lowercased and stripped of punctuation. Matches "iphone 15",
     "galaxy s24", "macbook pro", "ps5" etc. Good enough for sibling
     detection — full model parsing lives in normalize.ts. */
  const anchorModelPrefix = anchor.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");

  function looksLikeSibling(d: DupeResult): boolean {
    /* Sibling requires (at least) brand match AND model-prefix overlap.
       Without brand match, we can't be confident it's the same product
       line — better to leave it in cross-brand alternatives. */
    const dBrand = (d.brand ?? "").toLowerCase().trim();
    if (!anchorBrand || !dBrand || anchorBrand !== dBrand) return false;
    if (!anchorModelPrefix) return false;
    /* Check if any 2-word slice of the anchor's model prefix appears
       in the dupe's title — catches "iphone 15" within "iPhone 15
       Plus" or "galaxy s24" within "Galaxy S24 Ultra". */
    const dTitleLc = d.title.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const tokens = anchorModelPrefix.split(" ");
    for (let i = 0; i <= tokens.length - 2; i++) {
      const slice = tokens.slice(i, i + 2).join(" ");
      if (dTitleLc.includes(slice)) return true;
    }
    return false;
  }

  for (const d of dupes) {
    /* anchor.family lets the caller pass an authoritative product
       family (from category_slug) so detection inside the gate
       isn't repeated for every dupe. When omitted, the gate
       falls back to detecting family from the anchor title. */
    const isVariant = isLikelySameProduct(
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
   FTS pooling found the same variant across retailers). */
export function variantOffers(variants: DupeResult[]): StoreOffer[] {
  return variants.flatMap((v) => v.offers);
}
