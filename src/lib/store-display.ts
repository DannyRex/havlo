/* Shared store-name display helper.

   Background: SerpAPI returns merchant strings in many shapes:
     "Amazon.de - Amazon.de-Seller"
     "Amazon.ae - Retail"
     "Myntra - MNow"
     "Walmart - SellerXYZ"
     "JD Sports - Global"

   At ingest time we run `canonicaliseSource` (in
   src/lib/providers/search-serpapi.ts) which collapses the most
   common variants (Amazon's ".co.uk-Seller" etc.) into clean names.
   But:
     1. canonicaliseSource only knows ~6 specific cases. Many other
        long-suffix patterns leak through.
     2. Old DB rows ingested BEFORE canonicaliseSource existed still
        carry the raw unwieldy storeName.

   This file is the DISPLAY-TIME defence. Every card, PDP, and
   button that renders a storeName should run it through
   `displayStoreName()`. Pure function, no side effects, safe to
   call at every render.

   QA report May 2026: "View at amazon.co.uk - amazon.co.uk-Seller"
   text wraps on mobile compare button. The ingest-time canonical
   already returns "Amazon UK" for new rows, but old rows escaped.
   Display-time normalisation closes the gap retroactively without
   requiring a DB backfill. */

/* Curated rules for high-frequency merchants. Order matters: more
   specific patterns first. Mirrors the ingest-time
   canonicaliseSource so display matches what new rows would store. */
const KNOWN_RULES: Array<{ test: (lc: string) => boolean; out: string }> = [
  /* Amazon variants — UK first because it's the most-suffixed
     ("Amazon.co.uk - Amazon.co.uk-Seller" pattern).

     Each rule catches THREE shapes of the same merchant: the
     dotted-domain form, the country-word form, AND the bare 2-letter
     country code with whitespace separator. Without the third form,
     re-audit caught "Amazon DE" (literal storeName) NOT matching
     the Germany rule (no dot, no "germany" word) → falling through
     to the generic stripper → displayed as "Amazon DE" → not
     deduped with the "Amazon Germany" canonical key → /de/deals
     stores list showed both as separate entries despite being
     the same merchant. */
  { test: (lc) => lc.includes("amazon.co.uk") || lc.startsWith("amazon uk")
                  || lc.startsWith("amazon-uk"),                                    out: "Amazon UK" },
  { test: (lc) => lc.includes("amazon.de")    || lc.startsWith("amazon germany")
                  || lc.startsWith("amazon de") || lc.startsWith("amazon-de"),     out: "Amazon Germany" },
  { test: (lc) => lc.includes("amazon.ae")    || lc.startsWith("amazon uae")
                  || lc.startsWith("amazon ae") || lc.startsWith("amazon-ae"),     out: "Amazon UAE" },
  { test: (lc) => lc.includes("amazon.in")    || lc.startsWith("amazon india")
                  || lc.startsWith("amazon in") || lc.startsWith("amazon-in"),     out: "Amazon India" },
  { test: (lc) => lc.includes("amazon.ca")    || lc.startsWith("amazon canada")
                  || lc.startsWith("amazon ca") || lc.startsWith("amazon-ca"),     out: "Amazon Canada" },
  { test: (lc) => lc.includes("amazon.com")   || lc.startsWith("amazon - amazon")
                  || lc === "amazon"          || lc.startsWith("amazon seller")
                  || lc.startsWith("amazon us") || lc.startsWith("amazon-us"),     out: "Amazon" },

  /* Retailer-specific variants. */
  { test: (lc) => lc.startsWith("jd sports")  || lc.startsWith("jdsports"),         out: "JD Sports" },
  { test: (lc) => lc.startsWith("currys"),                                          out: "Currys" },
  { test: (lc) => lc.startsWith("john lewis"),                                      out: "John Lewis & Partners" },
  /* Walmart — the SerpAPI / Google Shopping feed returns ~20+
     "Walmart - SellerXYZ" sub-marketplace variants for the same
     parent. Collapsing them to "Walmart" matches user mental model
     and prevents the audit's "noisy store list" finding. */
  { test: (lc) => lc.startsWith("walmart"),                                         out: "Walmart" },
  { test: (lc) => lc.startsWith("best buy")   || lc.startsWith("bestbuy"),          out: "Best Buy" },
  /* eBay — same sub-seller pattern. "eBay - authenticdeals" /
     "eBay - mich_592413" / etc. all collapse to "eBay". Per-seller
     reputation isn't a price-comparison axis users care about at
     the listing level. */
  { test: (lc) => lc.startsWith("ebay")       || lc.startsWith("e-bay"),            out: "eBay" },
  { test: (lc) => lc.startsWith("noon"),                                            out: "Noon" },
  { test: (lc) => lc.startsWith("myntra"),                                          out: "Myntra" },
  { test: (lc) => lc.startsWith("flipkart"),                                        out: "Flipkart" },
  { test: (lc) => lc.startsWith("nykaa"),                                           out: "Nykaa" },
  { test: (lc) => lc.startsWith("takealot"),                                        out: "Takealot" },
];

/* Generic suffix stripper for the long tail. After the curated rules
   miss, drop everything after the first " - " separator. Safe because:
     · "Amazon.de - Amazon.de-Seller"  → "Amazon.de"   (clean)
     · "Myntra - MNow"                 → "Myntra"      (clean)
     · "Walmart - SellerABC"           → "Walmart"     (clean)
     · "Some Store"                    → "Some Store"  (no " - ", unchanged)
   The rare false-positive (a real merchant named "Foo - Bar") is
   acceptable trade — those names are user-hostile anyway and the
   shorter form is more readable. */
function stripSuffix(name: string): string {
  const idx = name.indexOf(" - ");
  if (idx === -1) return name;
  return name.slice(0, idx).trim();
}

/* Hard cap for any merchant name on a button/card. 32 chars covers
   "John Lewis & Partners" + a tiny margin. Anything longer gets
   ellipsised so mobile button copy never wraps. */
const MAX_LEN = 32;

function truncate(name: string): string {
  return name.length <= MAX_LEN ? name : `${name.slice(0, MAX_LEN - 1).trim()}…`;
}

/** Convert a raw storeName into a clean display string for cards,
    PDP buttons, and any other UI surface. Idempotent — calling
    twice is safe. */
export function displayStoreName(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const lc = trimmed.toLowerCase();
  for (const r of KNOWN_RULES) {
    if (r.test(lc)) return r.out;
  }
  return truncate(stripSuffix(trimmed));
}
