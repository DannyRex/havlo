"use client";

import { useEffect, useState } from "react";
import { formatCount } from "@/lib/utils";

/* Live category-count badge for the homepage tile.

   Why client-side: the tile count and the /deals All-tab count read the
   SAME number (originCounts.all from /api/deals?category=…&origin=all),
   but the homepage bakes its copy into ISR HTML (minutes old) while
   /deals fetches the live, edge-cached response on every visit. After a
   data change — a fresh ingest, or the June 2026 cross-border fix that
   reclassified hundreds of offers — the baked tile and the live All-tab
   diverge until the homepage regenerates. (Reported repeatedly: "the
   deals-by-category card count is different from the All-tab count.")

   Fix: render the SSR `initial` immediately (no flash; it also drives
   the grid's count-sorted order), then refresh from the exact endpoint
   /deals reads. Both hit the shared CDN edge cache for that URL, so the
   tile lands on the same number the visitor sees after clicking through.
   On any fetch failure we keep the SSR value. */
export default function CategoryCount({
  countryCode,
  slug,
  initial,
}: {
  countryCode: string;
  slug: string;
  initial: number;
}) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let alive = true;
    /* All tiles hit the SAME /api/category-counts URL, so the browser/CDN
       serves one cached response to all of them (one origin compute) and
       each reads its own slug. Same pool-derived number the /deals All-tab
       shows, so the tile stays aligned with the count after click-through. */
    fetch(`/api/category-counts?country=${countryCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d?.counts?.[slug];
        if (alive && typeof n === "number") setCount(n);
      })
      .catch(() => {
        /* keep the SSR value */
      });
    return () => {
      alive = false;
    };
  }, [countryCode, slug]);

  return <>{formatCount(count)} deals</>;
}
