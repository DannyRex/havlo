"use client";

/* Context-aware back link on PDPs. Routes to /deals by default
   (most PDPs are reached from there), but upgrades to "Back to
   results" pointing at the originating /compare URL when the
   visitor arrived from there.

   Two referrer signals checked, in priority:

   1. sessionStorage["havlo:lastCompareUrl"] — set by the compare
      page on every render. Captures CLIENT-SIDE Next.js Link
      navigations (compare → "View product" → PDP) which document
      .referrer doesn't see — the App Router's <Link> doesn't
      bump document.referrer; it stays as whatever URL originally
      loaded the SPA.

   2. document.referrer — covers full-page loads (typed URL,
      hard refresh, share link click, external link). When the
      session storage entry is absent or stale, this still works
      for the "external visit to a compare URL → click PDP card →
      see compare back link" path.

   Why a client component instead of searchParams on the PDP
   route: adding searchParams to /[country]/p/[id] marks the
   route dynamic and breaks the 1-hour ISR window. Client-side
   detection keeps the server cache key clean.

   User report May 2026 v1: "going from the compare page to pdp,
   the back button should take me to compare not deals."
   User report May 2026 v2 (audit): "PDP reached from /compare via
   'View product' click still showed Back to deals" — exposed the
   document.referrer-only approach missing client-side nav. */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  countryCode: string;
}

const COMPARE_URL_STORAGE_KEY = "havlo:lastCompareUrl";
/* Storage entries older than 15 SECONDS are treated as stale.
   Shortened from 5 min after the audit-retest caught a leak: a
   user who visited /compare then later went /deals → PDP saw
   "Back to results" routing to the old compare URL because the
   breadcrumb was still fresh. 15 seconds covers the realistic
   compare → "View product" → PDP click latency (~1-3 seconds)
   with comfortable headroom, but expires before the user can
   meaningfully navigate away to /deals or anywhere else.

   For full-page-load cases (typed URL, hard refresh), the
   document.referrer fallback below still kicks in regardless of
   storage staleness. */
const STALE_AFTER_MS = 15 * 1000;

interface CompareBreadcrumb {
  url: string;
  ts:  number;
}

export default function PdpBackLink({ countryCode }: Props) {
  /* Initial state matches the SSR-rendered link so first paint is
     stable. On mount the effect inspects sessionStorage +
     document.referrer and swaps the link if appropriate. The swap
     is text + href only — no layout shift — so the brief flash
     is invisible to most visitors and harmless when noticed. */
  const [href, setHref]   = useState<string>(`/${countryCode}/deals`);
  const [label, setLabel] = useState<string>("Back to deals");

  useEffect(() => {
    if (typeof window === "undefined") return;

    /* Pass 1: sessionStorage breadcrumb left by the compare page.
       This is the primary signal because it works for client-side
       <Link> navigations within the SPA, which document.referrer
       does NOT capture. */
    try {
      const raw = sessionStorage.getItem(COMPARE_URL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CompareBreadcrumb;
        if (parsed.url && Date.now() - parsed.ts < STALE_AFTER_MS) {
          /* Verify the URL is same-origin + still a /compare path
             (defensive — the storage value should always be these
             but we don't trust client storage). */
          const url = new URL(parsed.url, window.location.origin);
          if (url.origin === window.location.origin && url.pathname.includes("/compare")) {
            setHref(url.pathname + url.search + url.hash);
            setLabel("Back to results");
            return;
          }
        }
      }
    } catch {/* malformed storage — fall through to referrer */}

    /* Pass 2: document.referrer fallback. Works for full-page
       loads from /compare (typed URL, hard refresh, external
       link, share-preview click). Same-origin guard prevents
       arbitrary referrers from setting the back link. */
    const ref = document.referrer;
    if (!ref) return;
    try {
      const url = new URL(ref);
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.includes("/compare")) return;
      setHref(url.pathname + url.search + url.hash);
      setLabel("Back to results");
    } catch {/* malformed referrer — keep the default deals link */}
  }, []);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs sm:text-sm text-ink-3 hover:text-ink transition-colors mb-5 sm:mb-7"
    >
      <ChevronLeft size={14} aria-hidden="true" />
      {label}
    </Link>
  );
}
