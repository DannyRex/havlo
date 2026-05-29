"use client";

/* About-this-product section.

   Slots between the PriceHistoryChart and the "You may also like"
   rail. Three jobs:

     1. Give the page visible body copy. Until May 29 2026 the PDP
        had ZERO prose between the hero CTA and the alternatives
        rail — the JSON-LD description sat in <head> only, which
        Google's HCU and AI Overview pipelines weight far less than
        rendered text. This section closes that gap.

     2. Surface the merchant description we already collect (via
        products.description, populated by ingestion.ts when the
        scraper carries one). Shown truncated with a Read-more
        toggle; the FULL text is in the SSR HTML so crawlers and
        AI Overviews see the whole thing regardless of the toggle
        state. Cited to the source store to keep the legal /
        attribution posture clean.

     3. Render a small set of structured spec chips parsed from
        the title via buildSignature. Storage / RAM / display
        size / colour — only when extracted with high confidence;
        silently omitted when we'd be guessing.

   Deliberately NOT in scope: LLM-generated paragraphs. Google's
   Helpful Content update specifically targets thin AI prose; our
   honest move is to surface what's real + structured + cited.

   Client component so the Read-more toggle is interactive. The
   full content still renders in SSR HTML — only the CLAMP changes
   on toggle. */

import { useState } from "react";
import { brandDisplay } from "@/lib/brand-display";
import { displayStoreName } from "@/lib/store-display";
import type { DisplaySpec } from "@/lib/product-specs";

interface Props {
  /** Brand, already resolved server-side via resolveBrand() — uses
      products.brand when present, falls back to the signature
      parser otherwise. Lowercase from the DB; this component
      handles display casing via brandDisplay. */
  brand:        string | null;
  categorySlug: string | null;
  /** Pre-extracted spec rows. Built server-side via
      extractDisplaySpecs() so this client component doesn't need
      to import @/lib/search/normalize (which loads optional
      datasets via Node's fs and breaks the browser bundle). */
  specs:        DisplaySpec[];
  /** Merchant body description from products.description (via
      fetchProductDescription). Null when the column is empty or
      the offer is a curated synthetic-id. */
  description?: string | null;
  /** Store the merchant description came from. Used in the citation
      line ("Description from the X listing"). When description is
      null this prop is unused. */
  storeName:    string;
  /** Total stores carrying this product (for the "tracked across N
      stores in {country}" tail). Same number that drives the hero
      "Compare X stores" badge so the two surfaces agree. */
  storeCount:   number;
  countryName:  string;
}

/* Character cap for the visible (un-expanded) merchant description.
   Chosen so the section renders ~3 lines on mobile at typical body
   font + leading, which is roughly the engagement threshold before
   visitors skip past. The full text is always in the SSR HTML; this
   number only controls what the visitor sees without expanding. */
const TRUNCATE_AT = 320;

/* Brand display now comes from the shared @/lib/brand-display
   module so the ProductHero eyebrow pill and this section render
   the same string for the same raw DB value. */

/* Category label map — controls the noun in the intro line. Kept
   in sync with the categorisation in src/lib/categorize.ts; each
   slug maps to the singular descriptor we'd read aloud. */
const CATEGORY_LABEL: Record<string, string> = {
  phones:      "smartphone",
  computing:   "computer",
  electronics: "electronics product",
  audio:       "audio device",
  appliances:  "home appliance",
  gaming:      "gaming product",
  fashion:     "fashion item",
  beauty:      "beauty product",
  home:        "home product",
  sports:      "sports product",
};

function categoryLabelFor(slug: string | null | undefined): string {
  if (!slug) return "product";
  return CATEGORY_LABEL[slug] ?? "product";
}

/* Indefinite-article helper. "a smartphone" / "an audio device" —
   honest English even on auto-generated copy. */
function indefiniteArticle(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/* Spec extraction moved to @/lib/product-specs (server-only). This
   client component receives the pre-built array via props. */

/* Strip any HTML tags + collapse whitespace. Shopify merchant
   descriptions occasionally land as raw HTML through the JSON
   feed (3CHub, PayPorte sometimes do this). We don't want to
   dangerouslySetInnerHTML a third-party blob, and we don't want
   visible <p> tags in the rendered text either. Conservative
   strip — leaves the plain text behind. */
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

export default function ProductAbout({
  brand,
  categorySlug,
  specs,
  description,
  storeName,
  storeCount,
  countryName,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const brandLabel    = brandDisplay(brand);
  const categoryLabel = categoryLabelFor(categorySlug);
  const article       = indefiniteArticle(categoryLabel);
  const storeLabel    = displayStoreName(storeName);

  /* Factual intro — no claims, no superlatives, no "flagship" or
     "premium". Three forms:
       1. Brand known:    "{Brand} {categoryLabel}."
       2. No brand, just: "{Category} listed on Havlo."

     The previous "This product is a smartphone from Apple" phrasing
     read like filler — it told the visitor something they could
     read from the title above it. Tighter, more useful when the
     brand IS the headline signal. */
  const intro = brandLabel
    ? `${brandLabel} ${categoryLabel}.`
    : `${categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1)} listed on Havlo.`;
  void article;  // reserved for future "an electronics product" phrasing

  const coverage = storeCount > 1
    ? `Tracked across ${storeCount} stores in ${countryName}.`
    : `Tracked at one store in ${countryName}.`;

  /* Merchant description — sanitise + decide truncation state. */
  const merchantClean = description ? stripHtml(description) : "";
  const merchantValid = merchantClean.length >= 50;  // skip junk-short captures
  const needsTruncate = merchantClean.length > TRUNCATE_AT;
  const merchantShown = needsTruncate && !expanded
    ? merchantClean.slice(0, TRUNCATE_AT).trimEnd() + "…"
    : merchantClean;

  /* specs comes from props (extracted server-side via
     extractDisplaySpecs in @/lib/product-specs). */

  /* Edge case: section content is JUST the intro + coverage line
     (no merchant text, no specs). That's still useful body copy —
     better than the bare price page that came before. So we never
     short-circuit the section. */

  return (
    <section className="mt-10 sm:mt-12">
      <h2 className="text-[20px] sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight mb-3">
        About this product
      </h2>

      <p className="text-sm sm:text-base text-ink-2 leading-relaxed">
        {intro} {coverage}
      </p>

      {merchantValid && (
        <div className="mt-4">
          {/* Full text always in SSR HTML — only visible clip changes
              on toggle. Bots, AI Overviews and screen readers see the
              entire merchant body regardless of the visitor's expand
              state. */}
          <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">
            {merchantShown}
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
        </div>
      )}

      {specs.length > 0 && (
        <>
          <dl className="mt-5 flex flex-wrap gap-2" aria-label="Specifications">
            {specs.map((s) => (
              <div
                key={s.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px]"
              >
                <dt className="text-ink-3">{s.label}:</dt>
                <dd className="font-semibold text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
          {/* Provenance footer is gated on specs rendering — the
              footer specifically says "inferred from listing titles"
              and would be misleading on a section that shows no
              specs (no chips => nothing was inferred). When only
              the merchant description renders, its own "Description
              from the X listing" cite is the provenance. */}
          <p className="mt-4 text-[11px] text-ink-3 leading-snug">
            Specifications are inferred from listing titles. Confirm at the store before purchase.
          </p>
        </>
      )}
    </section>
  );
}
