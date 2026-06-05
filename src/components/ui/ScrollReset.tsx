"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/* Scroll behaviour, differentiated by navigation type:

     forward nav to a new route   -> scroll to top
     back / forward (popstate)    -> let the browser RESTORE the old position
     hard reload                  -> scroll to top
     filter / sort on same route  -> untouched (same pathname; the /deals feed
                                     uses router.replace(..., { scroll:false }))

   Restoring position on Back is the high-value behaviour for a deals feed:
   scroll the feed, open a product, hit Back, land exactly where you were. The
   previous version forced the top on every navigation, which broke that. We
   only force the top on (a) forward route changes and (b) a hard reload -- the
   reload case because the lazy/ISR feed makes restoring to a stale offset
   janky (content above can shift or not be loaded yet). */
export default function ScrollReset() {
  const pathname = usePathname();
  const isPop = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    /* Let the browser own restoration for back/forward (and the reload case we
       don't override). 'auto' is the default, but set it explicitly to undo any
       'manual' a previously-cached build may have left on the history object. */
    if ("scrollRestoration" in window.history) {
      try { window.history.scrollRestoration = "auto"; } catch { /* read-only in some webviews */ }
    }

    const onPop = () => { isPop.current = true; };
    window.addEventListener("popstate", onPop);

    /* First load: reset to top only on a HARD RELOAD. A back/forward full-page
       load restores (browser), and a fresh navigate is already at the top. */
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav?.type === "reload" && !window.location.hash) window.scrollTo(0, 0);
    } catch { /* Performance API unavailable -- leave the browser default */ }

    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mounted.current) { mounted.current = true; return; } // initial load handled above
    if (isPop.current) { isPop.current = false; return; }      // back/forward -> keep restored position
    if (window.location.hash) return;                          // anchor-targeted nav
    window.scrollTo(0, 0);                                     // forward nav -> top
  }, [pathname]);

  return null;
}
