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

  return (
    <div className={cellClass} style={{ width: size, height: size }}>
      {!failed && storeLogoUrl ? (
        <Image
          src={storeLogoUrl}
          alt={storeName}
          width={inner}
          height={inner}
          className="object-contain"
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
