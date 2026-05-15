/* /api/log-search — fire-and-forget search-event logger.

   Captures every search the user performs into search_query_log
   (migration 0026). Powers:
     • popular-search suggestions on the Hero / empty state
     • zero-result reporting (catalog gaps)
     • ranking training data (which queries → which products)

   Client contract: NO RESPONSE NEEDED. Clients call this without
   awaiting (or with sendBeacon for max reliability on unload). We
   return a tiny 204 to satisfy the fetch promise but the client
   should ignore the result.

   POST body:
     {
       query:        string,           // the literal search text
       surface:      "hero" | "deals" | "compare",
       mode?:        "text" | "url",   // defaults to "text"
       resultCount?: number,            // 0 = no results
     }

   Country comes from the server-side cookie/header detection, NOT
   from the client body. Trusting client country would let a tab
   write entries for any market.

   Defensive: silently no-ops if Supabase isn't configured or the
   query is empty. Never errors back to the client — a search log
   failure shouldn't block UI. */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { getServerCountry } from "@/lib/country-server";

interface Body {
  query?:        string;
  surface?:      string;
  mode?:         string;
  resultCount?:  number;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json() as Body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const query   = body.query?.trim();
  const surface = body.surface;
  if (!query || query.length < 2) return new NextResponse(null, { status: 204 });
  if (surface !== "hero" && surface !== "deals" && surface !== "compare") {
    return new NextResponse(null, { status: 204 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) return new NextResponse(null, { status: 204 });

  const country = getServerCountry();
  const mode = body.mode === "url" ? "url" : "text";

  /* Fire the insert but don't await — return 204 to the client
     immediately. The insert is best-effort; a slow DB shouldn't
     hold up the user-facing flow. Errors swallowed inside the
     thenable so they never surface as unhandled promise warnings. */
  const insertPromise = supa
    .from("search_query_log")
    .insert({
      country:      country.code,
      query:        query.slice(0, 200),
      surface,
      mode,
      result_count: typeof body.resultCount === "number" ? body.resultCount : null,
    })
    .then(() => undefined, () => undefined);
  void insertPromise;

  return new NextResponse(null, { status: 204 });
}
