"use client";

/* Store-logo cell used across /compare result surfaces (anchor offer
   rows, DupeCard badges, PriceResults single-mode rows).

   Resolution tiers (each falls through to the next on failure):
     1. storeLogoUrl — usually the /logos/<storeId>.png convention.
        Only ~60 of those files are actually bundled, so long-tail
        SerpAPI stores (jacamo, mercari, it-net, …) 404 here.
     2. The store's favicon via Google's s2 service, keyed on the
        hostname of one of its merchant URLs. This is the same service
        the homepage marquee (StoreLogoChip) uses and it renders real
        logos for the vast majority of retailers.
     3. A letter badge with the store's first character.

   The letter badge is ALWAYS rendered as the base layer; the logo
   <img> overlays it. So even when a favicon "loads" but paints
   nothing (blank/transparent), or every tier fails, the cell still
   shows a visible store indicator instead of an empty box. */

import { useState } from "react";
import { storeLogoInvertClass } from "@/lib/store-logo-invert";
import { toAbsoluteMerchantUrl } from "@/lib/pdp-url";

interface Props {
  storeId:      string;
  storeName:    string;
  storeLogoUrl: string;
  /** A merchant URL for one of this store's offers. Its hostname is
      used to fetch the store's favicon when storeLogoUrl 404s.
      Optional — without it the cell falls straight to the letter
      badge on a logo failure (no regression, just less coverage). */
  merchantUrl?: string;
  /** Outer cell side length in px. Defaults to 40 (matches the
      compare anchor offer rows). */
  size?: number;
  /** Inner padding in px on each side. Defaults to 6. */
  pad?: number;
}

/* Google s2 favicon for the store's own domain, derived from one of
   its merchant URLs. Returns null for relay / internal / unparseable
   URLs — those have no useful favicon (google.com would just give a
   generic Google mark). toAbsoluteMerchantUrl unwraps the /api/go
   relay wrapper so we read the real merchant hostname. */
function faviconFromMerchantUrl(merchantUrl?: string): string | null {
  if (!merchantUrl) return null;
  try {
    const host = new URL(toAbsoluteMerchantUrl(merchantUrl)).hostname.toLowerCase();
    if (!host || host === "google.com" || host.endsWith(".google.com")) return null;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return null;
  }
}

export default function StoreLogo({
  storeId,
  storeName,
  storeLogoUrl,
  merchantUrl,
  size = 40,
  pad = 6,
}: Props) {
  const favicon = faviconFromMerchantUrl(merchantUrl);

  type Tier = "primary" | "favicon" | "letter";
  const [tier, setTier] = useState<Tier>(
    storeLogoUrl ? "primary" : favicon ? "favicon" : "letter",
  );

  const src =
    tier === "primary" ? storeLogoUrl
    : tier === "favicon" ? favicon
    : null;

  /* Step down a tier on each image error: primary -> favicon (if we
     have one) -> letter. */
  function handleError() {
    setTier((t) => (t === "primary" && favicon ? "favicon" : "letter"));
  }

  /* Outer cell uses page-matching bg + visible border so the cell is
     delimited in BOTH light and dark modes. */
  const cellClass =
    "rounded-lg overflow-hidden shrink-0 bg-bg border border-border flex items-center justify-center";

  const inner = size - pad * 2;
  const initial = storeName.trim().charAt(0).toUpperCase() || "•";

  /* Theme-aware inversion applies only to the curated /logos assets
     (some are white/dark-on-transparent). A favicon is full-colour
     and must never be inverted, so scope it to the primary tier. */
  const invertClass = tier === "primary" ? storeLogoInvertClass(storeId) : "";

  return (
    <div className={`${cellClass} relative`} style={{ width: size, height: size }}>
      {/* Letter badge — ALWAYS rendered as the base layer; the logo
          <img> overlays it when a tier resolves. Guarantees a visible
          store indicator in both themes even when every logo tier
          fails or a favicon loads but paints nothing. */}
      <span
        aria-hidden="true"
        className="font-bold text-ink-2 select-none"
        style={{ fontSize: Math.max(11, Math.round(inner * 0.55)) }}
      >
        {initial}
      </span>
      {src && (
        /* Plain <img> — skip the Vercel transform cap for store-logo
           thumbnails (rendered dozens of times per page, already tiny
           PNGs / favicons). Absolutely centered over the letter base. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={storeName}
          width={inner}
          height={inner}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 m-auto object-contain ${invertClass}`}
          onError={handleError}
        />
      )}
    </div>
  );
}
