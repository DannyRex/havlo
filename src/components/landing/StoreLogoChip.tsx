"use client";

/* Client subcomponent for the StoreLogos marquee. Lives in its own
   file because the parent StoreLogos is server-rendered (reads
   country from cookies) and we need client-side state here for the
   image-error fallback.

   Two-layer logo strategy:
     1. Try the resolved src (explicit override OR icon.horse favicon)
     2. On load failure, swap to a clean letter chip with the store's
        first character — looks intentional rather than a broken image
   icon.horse already has its OWN service-level fallback that returns
   a styled letter icon when no favicon is found, so the component-
   level fallback here is a backup for network errors / CORS / DNS
   failures only. Defense in depth.

   Service choice: icon.horse over Google s2 / DuckDuckGo because
   it's the only one we tested that handles the long tail (Shopify-
   hosted NG retailers like 3chub, defunct domains, etc.) without
   returning generic globe placeholders. Clearbit logo API was
   tried and abandoned — HubSpot has restricted the public endpoint
   since acquiring them. */

import Image from "next/image";
import { useState } from "react";

export interface StoreEntry {
  name:       string;
  /** Path under /public/logos OR a full https URL. Optional, overrides
      the domain-based icon.horse lookup when we want a specific asset
      (e.g. for stores where the favicon is wrong or missing). */
  logo?:      string;
  /** Retailer's primary domain. Used to build an icon.horse URL when
      no `logo` override is set. */
  domain?:    string;
  /** White-on-transparent assets get inverted in light mode so they
      read on the white chip background. */
  whiteLogo?: boolean;
}

/** Build an icon.horse favicon URL for a store's domain. */
function faviconUrl(domain: string): string {
  return `https://icon.horse/icon/${domain}`;
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

  return (
    <div className="flex items-center gap-2.5 shrink-0 group cursor-default">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md overflow-hidden flex items-center justify-center bg-bg border border-border shrink-0">
        {!showLetter && src ? (
          <Image
            src={src}
            alt={ariaHidden ? "" : store.name}
            width={32}
            height={32}
            /* Skip optimizer for any remote URL so we don't have to
               whitelist hosts in next.config. Local /public/logos
               assets keep optimization. */
            unoptimized={isRemote}
            onError={() => setImgFailed(true)}
            className={`w-5 h-5 sm:w-5 sm:h-5 object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 ${
              store.whiteLogo ? "invert dark:invert-0" : ""
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
