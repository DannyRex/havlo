"use client";

/* About-this-product section — merchant-body only.

   v1 (commit 71b3858) padded the section with a templated intro
   ("Apple smartphone. Tracked across 7 stores in Nigeria") and a
   row of spec chips parsed from the title. Founder caught the
   honest read: those weren't enrichment, they were echoes — the
   intro restated the h1, the chips restated tokens already in the
   title above. Provenance footer apologised for both.

   v2 (this) strips the section to its only piece of real data:
   the merchant body captured by ingestion into products.description.
   When that's present, the section earns its place on the page —
   visible body copy that came from a real merchant listing, cited.
   When it's absent (SerpAPI rows, curated catalogue, scrape paths
   that don't capture body), the section returns null and the PDP
   flows straight from the chart to the alternatives rail.

   Tradeoff accepted: ~60-70% of PDPs lose visible body copy in
   the gap. Better than padding every page with echo content that
   reads as filler — for both human visitors and the HCU classifier.
   The honest move is to show a real description when we have one
   and to stay quiet when we don't.

   Coverage is the lever — if we want this section on more PDPs,
   the right fix is teaching the Shopify / SerpAPI / scrape paths
   to capture Deal.description more aggressively at ingest, not
   layering inferred prose here. */

import { useState } from "react";
import { displayStoreName } from "@/lib/store-display";

interface Props {
  /** Merchant body from products.description (via
      fetchProductDescription). Section renders only when this is
      a non-trivial string. */
  description: string | null | undefined;
  /** Store the description came from. Used in the citation line
      and normalised via displayStoreName to handle SerpAPI's
      messier raw store strings ("Amazon.de - Amazon.de-Seller"). */
  storeName:   string;
}

/* Character cap for the visible (un-expanded) merchant description.
   Chosen so the section renders ~3 lines on mobile at typical body
   font + leading. The full text always lives in the SSR HTML — only
   the visible clip changes on toggle, so crawlers / AI Overviews /
   screen readers see the entire body regardless of expand state. */
const TRUNCATE_AT = 320;

/* Skip junk-short merchant captures — a few stores write 1-word
   "description" values that aren't real body copy. 50 chars is
   the minimum that reliably looks like a sentence. */
const MIN_LENGTH = 50;

/* Strip any HTML tags + decode common entities + collapse whitespace.
   Shopify merchant bodies sometimes arrive as raw HTML through the
   JSON feed (3CHub, PayPorte). We don't want dangerouslySetInnerHTML
   on third-party blobs, and we don't want visible <p> tags either. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g,  "'")
    .replace(/&lt;/gi,  "<")
    .replace(/&gt;/gi,  ">")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ProductAbout({ description, storeName }: Props) {
  const [expanded, setExpanded] = useState(false);

  const cleaned = description ? stripHtml(description) : "";
  if (cleaned.length < MIN_LENGTH) return null;

  const storeLabel    = displayStoreName(storeName);
  const needsTruncate = cleaned.length > TRUNCATE_AT;
  const shown = needsTruncate && !expanded
    ? cleaned.slice(0, TRUNCATE_AT).trimEnd() + "…"
    : cleaned;

  return (
    <section className="mt-10 sm:mt-12">
      <h2 className="text-[20px] sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight mb-3">
        About this product
      </h2>
      <p className="text-sm sm:text-base text-ink-2 leading-relaxed whitespace-pre-line">
        {shown}
      </p>
      {needsTruncate && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-[12px] font-medium text-ink-2 hover:text-ink underline underline-offset-4 decoration-ink-3/40 hover:decoration-ink"
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
      <p className="mt-2 text-[11px] text-ink-3 italic">
        Description from the {storeLabel} listing.
      </p>
    </section>
  );
}
