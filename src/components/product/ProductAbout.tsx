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
import type { ProductSignature } from "@/lib/search/normalize";
import { buildSignature } from "@/lib/search/normalize";

interface Props {
  /** Raw product title (offer.title). Shown verbatim only inside
      the spec extraction; the intro line uses brand + categoryLabel
      instead of repeating the hero's headline. */
  title:        string;
  brand:        string | null;
  categorySlug: string | null;
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

/* Brand display map — DB stores brand lowercase ("apple", "lg") but
   visitors expect display casing. Multi-cap brands ("LG", "HP") and
   stylised ones ("iRobot", "L'Oréal") get explicit entries; the rest
   fall through to title-case. */
const BRAND_DISPLAY: Record<string, string> = {
  apple:     "Apple",
  samsung:   "Samsung",
  google:    "Google",
  microsoft: "Microsoft",
  sony:      "Sony",
  lg:        "LG",
  hp:        "HP",
  dell:      "Dell",
  asus:      "Asus",
  lenovo:    "Lenovo",
  bose:      "Bose",
  jbl:       "JBL",
  beats:     "Beats",
  nike:      "Nike",
  adidas:    "Adidas",
  puma:      "Puma",
  fenty:     "Fenty",
  maybelline:"Maybelline",
  loreal:    "L'Oréal",
  oraimo:    "Oraimo",
  xiaomi:    "Xiaomi",
  tecno:     "Tecno",
  infinix:   "Infinix",
  itel:      "Itel",
  irobot:    "iRobot",
  bang:      "Bang & Olufsen",
  harman:    "Harman Kardon",
};

function brandDisplay(raw: string | null): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim();
  if (BRAND_DISPLAY[k]) return BRAND_DISPLAY[k];
  return k.charAt(0).toUpperCase() + k.slice(1);
}

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

interface Spec { label: string; value: string }

function buildSpecs(sig: ProductSignature): Spec[] {
  const out: Spec[] = [];
  /* Storage: filter on 8 GB floor so an "8GB RAM" parsed as storage
     by mistake (the regex is permissive) doesn't surface as a 0.008
     TB storage chip. Display TB when >= 1024 GB. */
  if (sig.storageGb !== null && sig.storageGb >= 8) {
    out.push({
      label: "Storage",
      value: sig.storageGb >= 1024 ? `${sig.storageGb / 1024} TB` : `${sig.storageGb} GB`,
    });
  }
  if (sig.ramGb !== null && sig.ramGb >= 2) {
    out.push({ label: "RAM", value: `${sig.ramGb} GB` });
  }
  /* Inches: only render for "looks like a screen size" range —
     3"–100". Catches tiny smartwatches at the low end and giant
     TVs at the high end, excludes accidental matches on shoe
     sizes or weight specs that leaked through the regex. */
  if (sig.inches !== null && sig.inches >= 3 && sig.inches <= 100) {
    out.push({ label: "Display", value: `${sig.inches}"` });
  }
  if (sig.color) {
    out.push({
      label: "Colour",
      value: sig.color.charAt(0).toUpperCase() + sig.color.slice(1),
    });
  }
  return out;
}

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
  title,
  brand,
  categorySlug,
  description,
  storeName,
  storeCount,
  countryName,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const sig = buildSignature(title);
  const brandLabel    = brandDisplay(brand ?? sig.brand);
  const categoryLabel = categoryLabelFor(categorySlug);
  const article       = indefiniteArticle(categoryLabel);

  /* Factual intro — no claims, no superlatives, no "flagship" or
     "premium". One sentence that states what the product is, one
     tail line that grounds it in Havlo's coverage scope. */
  const intro = brandLabel
    ? `This product is ${article} ${categoryLabel} from ${brandLabel}.`
    : `This product is ${article} ${categoryLabel}.`;

  const coverage = storeCount > 1
    ? `Havlo tracks prices for it across ${storeCount} stores in ${countryName}.`
    : `Havlo currently tracks one store carrying this product in ${countryName}.`;

  /* Merchant description — sanitise + decide truncation state. */
  const merchantClean = description ? stripHtml(description) : "";
  const merchantValid = merchantClean.length >= 50;  // skip junk-short captures
  const needsTruncate = merchantClean.length > TRUNCATE_AT;
  const merchantShown = needsTruncate && !expanded
    ? merchantClean.slice(0, TRUNCATE_AT).trimEnd() + "…"
    : merchantClean;

  const specs = buildSpecs(sig);

  /* Edge case: section content is JUST the intro + coverage line +
     provenance footer (no merchant text, no specs). That's still
     useful body copy — better than the bare price page that came
     before. So we never short-circuit the section. */

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
            Description from the {storeName} listing.
          </p>
        </div>
      )}

      {specs.length > 0 && (
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
      )}

      <p className="mt-4 text-[11px] text-ink-3 leading-snug">
        Specifications are inferred from listing titles. Confirm at the store before purchase.
      </p>
    </section>
  );
}
