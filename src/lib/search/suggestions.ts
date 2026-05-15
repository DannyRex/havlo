/* Search suggestions — did-you-mean + autocomplete shared logic.

   Two consumers:
     1. EmptySearchState's did-you-mean pills (rendered when /deals
        or /compare returns no results).
     2. Hero search-as-you-type autocomplete (debounced 200ms as
        the user types).

   Both surfaces call the same `suggest_titles` RPC (migration
   0008/0020/0024) which returns top-N closest titles via trigram
   similarity. Threshold tuning is in the RPC; this module is a
   thin wrapper that normalises shape + handles the network /
   Supabase unavailability cases.

   Output shape is a small record per suggestion:
     - title:   product title to show
     - key:     product_id so the UI can route to /compare?pid=
     - score:   similarity score 0..1 (optional, callers can ignore)

   When the RPC errors or the catalog is empty, returns []. Never
   throws — degrading gracefully keeps the empty state still
   useful (URL paste / notify-me / browse fallback all still
   render even when suggestions are absent). */

import { getSupabaseAdmin } from "@/lib/providers/db-client";

export interface SearchSuggestion {
  title: string;
  key:   string;
  score?: number;
}

interface RpcRow {
  product_id: string;
  title:      string;
  score:      number;
}

/* Fetch top-N closest title matches for a query. Trigram similarity
   threshold inside the RPC is 0.15 — relaxed enough to catch typos
   ("iphn 15" → "iPhone 15") while still filtering noise.

   Empty / too-short queries return [] without hitting the DB. */
export async function fetchSearchSuggestions(
  query: string,
  maxResults = 3,
): Promise<SearchSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supa = getSupabaseAdmin();
  if (!supa) return [];

  try {
    const { data, error } = await supa.rpc("suggest_titles", {
      q:            trimmed,
      max_results:  maxResults,
    });
    if (error || !data) return [];

    return (data as RpcRow[]).map((r) => ({
      title: r.title,
      key:   r.product_id,
      score: r.score,
    }));
  } catch {
    return [];
  }
}
