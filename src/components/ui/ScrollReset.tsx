"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Global scroll reset.

   The browser (and the Next App Router) restore the previous scroll
   offset on reload and on back/forward, which left visitors dropped
   mid-page when they reloaded or returned to a page. This pins every
   page (re)load and every real route change back to the top: the
   position each page was designed to open at.

   Keyed on PATHNAME ONLY. Query-string changes must NOT trigger it:
   the /deals feed updates its filter + sort via router.replace(...,
   { scroll: false }) precisely so the shopper stays put while toggling
   filters. Those keep the same pathname, so this effect never fires for
   them. A genuine page change (or a reload, which remounts) does.

   `scrollRestoration = "manual"` stops the browser re-applying the old
   offset after our reset (it would otherwise restore late, once more of
   a long ISR page paints in). In-page hash links (e.g.
   /p/[id]#price-history) are left alone so anchor jumps still work. */
export default function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      try {
        window.history.scrollRestoration = "manual";
      } catch {
        /* read-only in some embedded webviews — ignore */
      }
    }
    if (window.location.hash) return; // respect anchor-targeted loads
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
