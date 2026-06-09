"use client";

/* Store-logo cell used across /compare result surfaces (anchor offer
   rows, DupeCard badges, PriceResults single-mode rows).

   Resolution tiers (each falls through to the next on failure):
     1. storeLogoUrl — usually the /logos/<storeId>.png convention.
        Only ~60 of those files are actually bundled, so long-tail
        SerpAPI stores (jacamo, mercari, it-net, …) 404 here.
     2. The store's favicon via Google's s2 service, keyed on the
        store's CURATED canonical domain (resolveStoreDomain) when we
        know it, else the hostname of one of its merchant URLs. Keying
        on the curated domain first is the Finding #7 fix: the raw
        merchant host could be a relay / Google-Shopping redirect /
        mis-parsed URL, which made s2 hand back a generic Google globe
        instead of the retailer's mark.
     3. A letter badge with the store's first character.

   The letter badge is ALWAYS rendered as the base layer; the logo
   <img> overlays it. So even when a favicon "loads" but paints
   nothing (blank/transparent), or every tier fails, the cell still
   shows a visible store indicator instead of an empty box. */

import { useState, useRef, useEffect } from "react";
import { storeLogoInvertClass } from "@/lib/store-logo-invert";
import { resolveStoreDomain } from "@/lib/store-domains";
import { displayStoreName } from "@/lib/store-display";
import { BUNDLED_LOGOS } from "@/lib/bundled-logos";

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

export default function StoreLogo({
  storeId,
  storeName,
  storeLogoUrl,
  merchantUrl,
  size = 40,
  pad = 6,
}: Props) {
  /* Favicon source for the fallback tier. resolveStoreDomain prefers
     the store's curated canonical domain (reliable brand icon) and only
     falls back to the offer's own merchant host, returning null for
     relay / Google / ad-redirect hosts so we degrade to the letter
     badge rather than a wrong logo. Finding #7. */
  const domain = resolveStoreDomain(storeId, storeName, merchantUrl);
  const favicon = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : null;

  /* Only use the /logos/<slug>.png primary tier when that file is
     actually bundled (BUNDLED_LOGOS) — otherwise the <img> fires a
     guaranteed 404 before falling through to the favicon, which spammed
     the console + wasted a request per long-tail store. Non-/logos
     storeLogoUrls (rare) are always honoured. Deterministic, so SSR +
     client agree (no hydration churn). (QA Jun 2026.) */
  const logoSlug = /\/logos\/([^/]+)\.png$/.exec(storeLogoUrl || "")?.[1];
  const primaryUsable = !!storeLogoUrl && (logoSlug ? BUNDLED_LOGOS.has(logoSlug) : true);

  type Tier = "primary" | "favicon" | "letter";
  const [tier, setTier] = useState<Tier>(
    primaryUsable ? "primary" : favicon ? "favicon" : "letter",
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

  /* SSR onError race (QA Jun 2026): the <img> server-renders with the
     primary src and can finish loading — and FAILING (a 404'd
     /logos/<id>.png) — BEFORE React hydrates and attaches onError. The
     missed error left the tile stuck broken instead of falling through
     to the favicon (most visible on /brands, where most slugs have no
     bundled logo). After mount and after each tier change, re-check the
     live <img>: if it already errored (complete with zero natural size),
     step the tier down manually. Terminates at the letter tier (no img
     rendered), so no loop. */
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) handleError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, src]);

  /* Outer cell uses page-matching bg + visible border so the cell is
     delimited in BOTH light and dark modes. */
  const cellClass =
    "rounded-lg overflow-hidden shrink-0 bg-bg border border-border flex items-center justify-center";

  const inner = size - pad * 2;
  const initial = storeName.trim().charAt(0).toUpperCase() || "•";
  /* Cleaned name for the logo alt text. resolveStoreDomain and the
     letter badge above keep the raw storeName (domain resolution and
     the initial are unaffected by the marketplace suffix), but the
     alt is screen-reader-facing, so strip "eBay - <seller-handle>"
     down to "eBay" the same way every visible store label does. */
  const altName = displayStoreName(storeName);

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
          ref={imgRef}
          src={src}
          alt={altName}
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
