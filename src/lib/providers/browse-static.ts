/* Static browse provider — wraps the existing scraped data file.
   Always active, serves as the baseline / fallback when DB-backed
   providers return no rows.

   `getDeals` in @/lib/data/deals doesn't accept the `origin` filter, and
   the helpers `getOriginCounts` / origin-aware filtering live here so
   the static module stays a pure data file. */

import type { BrowseProvider, BrowseQuery, OriginCounts } from "./types";
import { getDeals } from "@/lib/data/deals";
import { deals } from "@/lib/data/deals";
import type { Deal } from "@/types";

/* USD currency is our locality signal — matches the rest of the app
   (live UI INTL chip, TrendingDeals quota). NGN ⇒ local, USD ⇒ intl. */
function isIntl(d: Deal): boolean {
  return d.currency === "USD";
}

function applyOriginFilter(items: Deal[], origin: BrowseQuery["origin"]): Deal[] {
  if (origin === "local") return items.filter((d) => !isIntl(d));
  if (origin === "intl")  return items.filter(isIntl);
  return items;
}

export const staticBrowseProvider: BrowseProvider = {
  id: "static-scraped",
  name: "Static (scraped data)",

  isActive() {
    return true;
  },

  async fetchDeals(q: BrowseQuery): Promise<Deal[]> {
    const base = getDeals({
      categorySlug: q.categorySlug,
      minDiscount: q.minDiscount,
      sort: q.sort,
      search: q.search,
    });
    /* Origin filter applied here because @/lib/data/deals#getDeals
       doesn't know about it. Caller (TrendingDeals etc.) relies on this
       to honor the local / intl quota split. */
    return applyOriginFilter(base, q.origin);
  },

  async getOriginCounts(q): Promise<OriginCounts> {
    const base = getDeals({
      categorySlug: q.categorySlug,
      minDiscount: q.minDiscount,
      search: q.search,
    });
    let local = 0;
    let intl  = 0;
    for (const d of base) {
      if (isIntl(d)) intl++; else local++;
    }
    return { all: base.length, local, intl };
  },

  async getCategoryCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const d of deals) {
      if (!d.categorySlug) continue;
      counts[d.categorySlug] = (counts[d.categorySlug] ?? 0) + 1;
    }
    return counts;
  },
};
