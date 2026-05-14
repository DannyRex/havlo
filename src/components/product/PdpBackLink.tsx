"use client";

/* Context-aware back link on PDPs. Routes to /deals by default
   (most PDPs are reached from there), but upgrades to the
   referrer URL when the visitor arrived from /compare so they
   land back on the search results they were looking at —
   filters, query, and pagination preserved.

   Why a client component instead of reading searchParams in the
   PDP server route: adding searchParams to /[country]/p/[id]
   marks the route dynamic and breaks the 1-hour ISR window
   (every URL variant becomes a fresh server render). A small
   client component reads document.referrer post-hydration
   without touching the server cache key.

   Fallback chain:
     1. Referrer is a same-origin /compare URL → "Back to results"
        with the exact referrer URL preserved.
     2. Anything else (direct nav, /deals click, share link,
        empty referrer from strict referrer-policy) → "Back to
        deals" → /[country]/deals.

   User report May 2026: "going from the compare page to pdp,
   the back button should take me to compare not deals." */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  countryCode: string;
}

export default function PdpBackLink({ countryCode }: Props) {
  /* Initial state matches the SSR-rendered link so first paint is
     stable. On mount the effect inspects document.referrer and
     swaps the link if appropriate. The swap is text + href only —
     no layout shift — so the brief flash is invisible to most
     visitors and harmless when noticed. */
  const [href, setHref]   = useState<string>(`/${countryCode}/deals`);
  const [label, setLabel] = useState<string>("Back to deals");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = document.referrer;
    if (!ref) return;
    try {
      const url = new URL(ref);
      /* Same-origin guard — a referrer from another domain
         (e.g. Twitter / Slack share preview) should NOT silently
         set the back link to that external URL. */
      if (url.origin !== window.location.origin) return;
      /* Match any /compare segment: bare /compare (middleware-
         redirected) or /[country]/compare. The path always
         contains "/compare" exactly once in either shape. */
      if (!url.pathname.includes("/compare")) return;
      /* Preserve the full URL including query string + hash so
         the user lands on the exact results view they left —
         q, mode, pid, and any future state params all survive. */
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
