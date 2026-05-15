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
  /** Dupes that are similar but not the same product — different
      size, generation, sub-model, etc. Stay in the "You may also
      like" rail as cheaper alternatives. */
  otherProducts: DupeResult[];
}

export function partitionDupesByVariantMatch(
  anchor: { title: string; brand: string | null; priceNgn: number },
  dupes: DupeResult[],
): PartitionResult {
  const likelyVariants: DupeResult[] = [];
  const otherProducts: DupeResult[] = [];

  for (const d of dupes) {
    const match = isLikelySameProduct(
      { title: anchor.title, brand: anchor.brand, priceNgn: anchor.priceNgn },
      { title: d.title,      brand: d.brand,      priceNgn: d.bestPrice },
    );
    (match ? likelyVariants : otherProducts).push(d);
  }

  return { likelyVariants, otherProducts };
}

/* Flatten variant DupeResults into a single StoreOffer[] suitable
   for merging into the anchor pool. Each variant carries its OWN
   per-store offers (a single dupe can have multiple stores when
   FTS pooling found the same variant across retailers). */
export function variantOffers(variants: DupeResult[]): StoreOffer[] {
  return variants.flatMap((v) => v.offers);
}
