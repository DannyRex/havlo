"use client";

/* Client subcomponent for the StoreLogos marquee. Lives in its own
   file because the parent StoreLogos is server-rendered (reads
   country from cookies) and we need client-side state here for the
   image-error fallback.

   Two-layer logo strategy:
     1. Try the resolved src (explicit override OR Google s2 favicon)
     2. On load failure, swap to a clean letter chip with the store's
        first character — looks intentional rather than a broken image

   Service choice: Google's s2 favicon service. It's been the
   battle-tested default and renders correct logos for the vast
   majority of stores in our rosters. We tried switching to DDG
   then icon.horse; both regressed icons for stores that were
   already working on s2. Lesson: don't replace something that's
   working for the long tail to fix one outlier. For specific
   stores where s2 returns wrong / generic icons, override via
   StoreEntry.logo with a Clearbit / icon.horse / static-asset
   URL at the call site instead of changing the global default. */

import { useState } from "react";

export interface StoreEntry {
  name:       string;
  /** Path under /public/logos OR a full https URL. Optional, overrides
      the domain-based favicon lookup when we want a specific asset
      (e.g. for stores where the favicon is wrong or missing). */
  logo?:      string;
  /** Retailer's primary domain. Used to build a Google s2 favicon URL
      when no `logo` override is set. */
  domain?:    string;
  /** White-on-transparent assets get inverted in light mode so they
      read on the white chip background. */
  whiteLogo?: boolean;
  /** Dark-on-transparent assets get inverted in DARK mode so they
      read on the dark chip background. Symmetric to whiteLogo.
      Use for monochrome dark wordmarks like the John Lewis
      vertical-stripe pattern that vanish on a dark bg-bg chip. */
  darkLogo?: boolean;
  /** Wide horizontal wordmark logos (3chub, Marks & Spencer, etc.)
      need a wider chip + different sizing so the wordmark stays
      readable. Without this, object-contain shrinks them to a few
      pixels tall in the standard square chip. */
  wideLogo?:  boolean;
}

/** Build a Google s2 favicon URL for a store's domain. Returns a
    64×64 PNG suitable for the marquee chip. Free, no API key, stable. */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export function StoreLogoChip({
  store,
  ariaHidden,
}: {
  store: StoreEntry;
  ariaHidden: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const src = store.logo ?? (store.domain ? faviconUrl(store.domain) : null);
  const isRemote = src?.startsWith("http") ?? false;
  const showLetter = !src || imgFailed;

  /* Wide wordmark logos get a horizontally larger chip so the brand
     mark stays readable. Square favicon-style icons keep the standard
     square chip. */
  const chipSize = store.wideLogo
    ? "w-16 h-7 sm:w-20 sm:h-8"
    : "w-7 h-7 sm:w-8 sm:h-8";
  const imgSize = store.wideLogo
    ? "w-14 h-5 sm:w-[68px] sm:h-6"
    : "w-5 h-5 sm:w-5 sm:h-5";

  return (
    <div className="flex items-center gap-2.5 shrink-0 group cursor-default">
      <div className={`${chipSize} rounded-md overflow-hidden flex items-center justify-center bg-bg border border-border shrink-0`}>
        {!showLetter && src ? (
          /* Plain <img> May 2026 v3 — was next/image with
             unoptimized={isRemote}. Even for local /public/logos
             assets, the optimizer transform burned ~80 transforms
             per /ng page load (one per store chip × srcset variants).
             Local PNGs are tiny + pre-optimized; the AVIF/WebP saving
             didn't justify the transformation cost. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={ariaHidden ? "" : store.name}
            width={store.wideLogo ? 80 : 32}
            height={32}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className={`${imgSize} object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 ${
              store.whiteLogo ? "invert dark:invert-0"
              : store.darkLogo ? "dark:invert"
              : ""
            }`}
          />
        ) : (
          /* Letter-chip fallback. Triggers when:
               - no src configured (no `logo` AND no `domain`)
               - the image network request failed (DNS, 404, CORS,
                 timeout) — onError fires and flips imgFailed to true */
          <span
            aria-hidden="true"
            className="text-[11px] sm:text-xs font-bold text-ink-3 group-hover:text-ink transition-colors"
          >
            {store.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-sm sm:text-base font-semibold text-ink-3 group-hover:text-ink transition-colors duration-300 whitespace-nowrap tracking-[-0.01em]">
        {store.name}
      </span>
    </div>
  );
}
