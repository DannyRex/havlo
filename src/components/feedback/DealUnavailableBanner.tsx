"use client";

/* Soft banner that renders when /api/go bounced the user back here
   because it couldn't resolve a Google-relay URL to a real merchant
   page at click time. Shown in two places:

     1. /[country] — when the deal click had no title hint to recover from
     2. /[country]/compare — when there was a title hint, the user lands
        on the search results for that title

   Why a banner not a toast: toasts get missed. The user just opened a
   new tab expecting to land on a merchant; landing on Havlo's home or
   search needs an in-page explanation, not a 4-second flash.

   The component is dismissible (X button), reads the search-param
   flag once on mount via useSearchParams, and removes the flag from
   the URL so a refresh doesn't re-trigger. */

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

export default function DealUnavailableBanner() {
  const params   = useSearchParams();
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /* Read flag on mount. Setting the visible state inside an effect
     avoids a hydration mismatch — the server doesn't have URL search
     params for the static export of /[country], so the initial
     render must not branch on them. */
  useEffect(() => {
    if (params.get("deal_unavailable") === "1") setOpen(true);
  }, [params]);

  function dismiss() {
    setOpen(false);
    /* Strip the flag from the URL so reload doesn't re-fire. Preserve
       any other params (q=, category=, etc.) the page actually needs. */
    const next = new URLSearchParams(params);
    next.delete("deal_unavailable");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-start gap-3">
        <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
        <div className="flex-1 text-[13px] leading-snug">
          <p className="font-semibold mb-0.5">That listing wasn&apos;t reachable.</p>
          <p className="text-ink-2">
            The merchant link couldn&apos;t be resolved (the listing may
            have moved or sold out). We&apos;ve brought you back here so
            you can find it elsewhere.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 rounded-md hover:bg-amber-500/20 transition-colors"
          aria-label="Dismiss notice"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
