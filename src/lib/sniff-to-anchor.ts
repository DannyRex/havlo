/* ──────────────────────────────────────────────────────────────────
   Convert a SniffResult (parsed from /api/sniff) into a ProductGroup
   that can be used as the anchor on the /compare page.

   Used by the URL-paste flow so the user's actual pasted product
   becomes the literal anchor — instead of pg-fts finding a "similar"
   product to anchor against, which causes the Pro Max ↔ base 15
   confusion the test report flagged.
   ────────────────────────────────────────────────────────────────── */

import { usdToNgn } from "@/lib/utils";
import type { ProductGroup, StoreOffer } from "@/lib/search";
import type { SniffResult } from "@/app/api/sniff/route";

function inferStoreId(store: string): string {
  return store
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

export function sniffToAnchor(sniff: SniffResult): ProductGroup | null {
  /* Title is required — without it we have nothing useful to display.
     Price is OPTIONAL: many retailers (Jumia included) hide price behind
     JS or don't expose it via og:price meta. We still want to render the
     anchor (image, store, "View on …" link) even when price is unknown
     — the dupes call falls back to "no ceiling" mode so we still surface
     cheaper alternatives based on similarity alone. */
  if (!sniff.ok || !sniff.title) return null;

  const hasPrice = typeof sniff.price === "number" && sniff.price > 0;
  const currency = (sniff.currency ?? "NGN").toUpperCase();
  const priceNgn = hasPrice
    ? (currency === "USD" ? usdToNgn(sniff.price as number) : (sniff.price as number))
    : 0;
  const storeId = inferStoreId(sniff.store ?? "external");

  const offer: StoreOffer = {
    storeId,
    storeName:      sniff.store ?? "External",
    storeLogoUrl:   `/logos/${storeId}.png`,
    storeColor:     "#0057FF",
    price:          priceNgn,
    currency:       "NGN",
    url:            sniff.url,
    imageUrl:       sniff.imageUrl ?? undefined,
    originalPrice:  priceNgn,
    discountPercent: 0,
    rating:         0,
    deliveryDays:   currency === "USD" ? 14 : 3,
    isInternational: currency === "USD",
    landedCostExtra: 0,
    landedPrice:    priceNgn,
  };

  return {
    key:           `sniff:${sniff.url}`,
    title:         sniff.title,
    category:      "general",
    imageUrl:      sniff.imageUrl ?? undefined,
    imageEmoji:    "🛒",
    imageGradient: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)",
    brand:         sniff.brand,
    model:         null,
    storageGb:     null,
    inches:        null,
    storeCount:    1,
    bestPrice:     priceNgn,
    worstPrice:    priceNgn,
    maxSavings:    0,
    offers:        [offer],
  };
}
