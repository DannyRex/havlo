/* Static browse provider — wraps the existing scraped data file.
   Always active, serves as the baseline / fallback. */

import type { BrowseProvider, BrowseQuery, OriginCounts } from "./types";
import { getDeals, getOriginCounts as staticOriginCounts } from "@/lib/data/deals";
import type { Deal } from "@/types";

export const staticBrowseProvider: BrowseProvider = {
  id: "static-scraped",
  name: "Static (scraped data)",

  isActive() {
    return true;
  },

  async fetchDeals(q: BrowseQuery): Promise<Deal[]> {
    return getDeals({
      categorySlug: q.categorySlug,
      minDiscount: q.minDiscount,
      sort: q.sort,
      search: q.search,
      origin: q.origin,
    });
  },

  async getOriginCounts(q): Promise<OriginCounts> {
    return staticOriginCounts({
      categorySlug: q.categorySlug,
      minDiscount: q.minDiscount,
      search: q.search,
    });
  },
};
