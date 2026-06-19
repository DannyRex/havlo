"use client";

/* Drops the PDP back-link breadcrumb for browse surfaces that aren't the
   deals feed (the deals feed writes its own, with the filtered URL). Render
   this on a page like the homepage with the label the back link should show:
   <RecordBrowseCrumb label="home" /> -> PdpBackLink renders "Back to home".

   Writes `havlo:lastBrowseUrl` = { url, ts, label } on mount + on URL change.
   PdpBackLink reads this alongside the compare crumb and uses whichever is
   freshest, so a homepage card -> PDP -> back returns to the homepage instead
   of falling through to a stale compare crumb or bare /deals. */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function RecordBrowseCrumb({ label }: { label: string }) {
  /* usePathname (not useSearchParams) so this needs no Suspense boundary on
     statically-rendered routes. window.location.href captured at write time
     still includes any query string. */
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        "havlo:lastBrowseUrl",
        JSON.stringify({ url: window.location.href, ts: Date.now(), label }),
      );
    } catch { /* private mode / quota exceeded — silent no-op */ }
  }, [pathname, label]);
  return null;
}
