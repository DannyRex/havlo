"use client";

/* Store-logo cell used across /compare result surfaces (anchor offer
   rows, DupeCard badges, PriceResults single-mode rows).

   Why this exists as a shared component:
     The bg-white containers we had before hid logos that have a
     transparent bg + white/light mark (favicon-sourced brand
     assets designed for dark navbars — common across the long
     tail). And the bg-surface-2 fallback was too close to white
     in light mode (#F7F8FA), so the same logos stayed invisible.

     StoreLogoChip in the homepage marquee already solved this:
     bg-bg + border-border for clear delimitation, plus an onError
     letter-fallback that renders the store's first character when
     the image fails. Long-tail seller storeIds with no
     corresponding /logos/<id>.png file (walmart-techmate-intl,
     93mobiles, vlebazaar-in, …) now show a clean letter badge
     instead of a broken image.

   Sizing is a prop so different surfaces can use the same
   component at different scales without re-implementing the
   shell+letter pattern. */

import Image from "next/image";
import { useState } from "react";

interface Props {
  storeId:      string;
  storeName:    string;
  storeLogoUrl: string;
  /** Outer cell side length in px. Defaults to 40 (matches the
      compare anchor offer rows). */
  size?: number;
  /** Inner padding in px on each side. Defaults to 6. */
  pad?: number;
}

/* Stores whose /logos/<id>.png is a white-on-transparent wordmark
   designed for dark navbars. On a light-mode bg-bg background
   (white-ish), they're invisible without an invert. Same approach
   the homepage marquee uses via StoreLogoChip's `whiteLogo` prop —
   except here the cell doesn't get a per-store prop from the call
   site (compare results render generic offer rows), so we look up
   storeId against a small known-bad registry instead.

   Add entries here when a new store ships a white-on-transparent
   logo file. Keep the list lowercased to match storeId convention. */
const WHITE_ON_TRANSPARENT_LOGOS = new Set<string>([
  "3chub",
  "threechub",
]);

/* Stores with dark-on-transparent wordmarks that vanish in dark
   mode (mirror of the above for the opposite theme). John Lewis
   is the canonical example. */
const DARK_ON_TRANSPARENT_LOGOS = new Set<string>([
  "john-lewis-partners",
  "john-lewis",
  "johnlewis",
]);

export default function StoreLogo({
  storeId,
  storeName,
  storeLogoUrl,
  size = 40,
  pad = 6,
}: Props) {
  const [failed, setFailed] = useState(false);

  /* Outer cell uses page-matching bg + visible border so the cell
     is delimited in BOTH light and dark modes. bg-bg evaluates to
     the page background; border-border is a theme-aware token
     that's just enough darker / lighter than the page to read as
     a deliberate edge. */
  const cellClass =
    "rounded-lg overflow-hidden shrink-0 bg-bg border border-border flex items-center justify-center";

  const inner = size - pad * 2;

  /* When the image src is missing OR onError fires, show the
     store's first character as a letter badge. The letter takes
     the surrounding ink color so it adapts to theme without
     further plumbing. */
  const initial = storeName.trim().charAt(0).toUpperCase() || "•";

  /* Theme-aware inversion: stores with white-on-transparent
     wordmarks get inverted in light mode (so the mark renders
     dark) and stay un-inverted in dark mode. Mirror for dark-
     on-transparent stores. Both keep the original at the
     non-conflicting theme so logo colour matches the brand
     anywhere it's visible. */
  const sidLc = storeId.toLowerCase();
  const invertClass =
    WHITE_ON_TRANSPARENT_LOGOS.has(sidLc) ? "invert dark:invert-0"
    : DARK_ON_TRANSPARENT_LOGOS.has(sidLc) ? "dark:invert"
    : "";

  return (
    <div className={cellClass} style={{ width: size, height: size }}>
      {!failed && storeLogoUrl ? (
        <Image
          src={storeLogoUrl}
          alt={storeName}
          width={inner}
          height={inner}
          className={`object-contain ${invertClass}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-bold text-ink-2"
          style={{ fontSize: Math.max(11, Math.round(inner * 0.55)) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
