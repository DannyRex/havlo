/* /api/log-pdp-view — fire-and-forget PDP view-event logger.
   Powers the B2B data product (docs/b2b-data-strategy.md). Until
   we capture VIEW events alongside the existing CLICK events, we
   cannot ship the funnel + engagement reports — they're 60% of
   what brands and retailers actually want to buy.

   GDPR-safe by construction:
     - No PII. session_id is the SHA-256 hash of an anonymous
       UUID cookie set by middleware on first visit.
     - No raw IP. The referrer URL is captured but capped to 500
       chars and never joined to a user identity.
     - Bot traffic (Googlebot / GPTBot / etc.) is tagged so it can
       be excluded from buyer-facing reports.

   Client contract: same as /api/log-search and /api/click — never
   await this from the page. Returns 204 immediately, insert runs
   detached. A logging failure must never block the UI.

   POST body:
     {
       productId?:  string  // UUID when known
       offerId?:    string  // UUID when known
       source?:     string  // 'google'|'direct'|'internal-deals'|'internal-compare'|'internal-similar'|'internal-blog'|'other'
       referrer?:   string  // raw document.referrer (capped)
     } */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { getServerCountry } from "@/lib/country-server";
import { cookies, headers } from "next/headers";
import crypto from "node:crypto";

interface Body {
  productId?: string;
  offerId?:   string;
  source?:    string;
  referrer?:  string;
}

const VALID_SOURCES = new Set([
  "google", "direct",
  "internal-deals", "internal-compare", "internal-similar",
  "internal-blog", "internal-search", "other",
]);

/* Lazy: hash the cookie value so the stored session_id is
   non-reversible. Even with full DB access nobody can map a row
   back to a real user identity. */
function sessionIdFromCookie(): string {
  const c = cookies().get("havlo_anon_session")?.value;
  if (!c) return "anon-no-cookie";
  return crypto.createHash("sha256").update(c).digest("hex").slice(0, 32);
}

/* Lightweight UA classifier — we don't need a full UA-parser
   library, just the bucket. Matches what reports will filter on. */
function classifyUserAgent(ua: string | null): string {
  if (!ua) return "unknown";
  const lower = ua.toLowerCase();
  if (/bot|crawler|spider|googlebot|bingbot|gptbot|claudebot|perplexitybot/.test(lower)) return "bot";
  if (/mobi|android|iphone/.test(lower) && !/tablet|ipad/.test(lower))                  return "mobile";
  if (/ipad|tablet/.test(lower))                                                         return "tablet";
  return "desktop";
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json() as Body; }
  catch { return new NextResponse(null, { status: 204 }); }

  const productId = body.productId && /^[0-9a-f-]{36}$/i.test(body.productId) ? body.productId : null;
  const offerId   = body.offerId   && /^[0-9a-f-]{36}$/i.test(body.offerId)   ? body.offerId   : null;
  /* At least one identifier required so we can attribute the view.
     Without either, the row would be analytics dead-weight. */
  if (!productId && !offerId) return new NextResponse(null, { status: 204 });

  const source = body.source && VALID_SOURCES.has(body.source) ? body.source : "other";

  const supa = getSupabaseAdmin();
  if (!supa) return new NextResponse(null, { status: 204 });

  const country  = getServerCountry();
  const ua       = headers().get("user-agent");
  const sessionId = sessionIdFromCookie();

  /* Fire-and-forget. Detached promise; errors swallowed inside the
     thenable so they don't surface as unhandled rejections. */
  const insertPromise = supa
    .from("pdp_views")
    .insert({
      session_id:       sessionId,
      country:          country.code,
      product_id:       productId,
      offer_id:         offerId,
      source,
      referrer:         body.referrer ? body.referrer.slice(0, 500) : null,
      user_agent_class: classifyUserAgent(ua),
    })
    .then(() => undefined, () => undefined);
  void insertPromise;

  return new NextResponse(null, { status: 204 });
}
