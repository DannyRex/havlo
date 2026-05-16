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

/* Resolve the store logo URL.

   Why this exists: inferStoreId() turns "Amazon UK" into "amazon-uk",
   then sniffToAnchor was building "/logos/amazon-uk.png" which doesn't
   exist (we only ship /logos/amazon.png). Result: broken-image icon on
   the result button.

   Multi-marketplace brands (Amazon UK / DE / AE / IN, Jumia .com / .ng,
   etc.) all share their parent brand logo. Map them to the canonical
   bundled icon. For genuinely unknown stores, fall back to Google's
   favicon service against the hostname so the chip always renders
   something rather than a broken image. */
const KNOWN_LOGOS: Record<string, string> = {
  jumia:       "/logos/jumia.png",
  konga:       "/logos/konga.png",
  aliexpress:  "/logos/aliexpress.png",
  asos:        "/logos/asos.png",
  slot:        "/logos/slot.png",
  shein:       "/logos/shein.png",
  temu:        "/logos/temu.png",
  dhgate:      "/logos/dhgate.png",
  jiji:        "/logos/jiji.png",
  spar:        "/logos/spar.png",
  "3c-hub":    "/logos/3chub.png",
  "3chub":     "/logos/3chub.png",
  threechub:   "/logos/threechub.png",
};

function getStoreLogoUrl(storeName: string, productUrl: string): string {
  const lc = storeName.toLowerCase().trim();

  /* Multi-marketplace Amazon — UK / DE / AE / IN / US all use the same
     amazon.png arrow logo. Recognised by prefix not slug because the
     id form is "amazon-uk", "amazon-de" etc. */
  if (lc.startsWith("amazon")) return "/logos/amazon.png";

  /* Match the slugged form against bundled logos. */
  const slug = lc.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  if (slug in KNOWN_LOGOS) return KNOWN_LOGOS[slug];

  /* Fall back to Google's favicon service. Always returns SOMETHING
     (real favicon for known sites, generic globe for unknown), so the
     chip never renders as a broken image. The 16px chip size hides
     most quality differences. */
  try {
    const hostname = new URL(productUrl).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return `/logos/${slug}.png`;
  }
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
    /* Sniffed anchors (paste-a-link flow) have no DB offer ID —
        they're constructed from page-scrape data. Empty string
        signals "synthetic" to downstream code that needs to route
        to /p/live instead of /p/[id]. */
    offerId:        "",
    storeId,
    storeName:      sniff.store ?? "External",
    storeLogoUrl:   getStoreLogoUrl(sniff.store ?? "External", sniff.url),
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
