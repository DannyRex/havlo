/* /api/amazon-search — outbound Amazon catalogue search.
   ──────────────────────────────────────────────────────────────────
   Lets a shopper search ALL of Amazon (not just the markdowns Havlo
   tracks) and land on Amazon with our Associates tag applied, so the
   click qualifies under the affiliate relationship that funds cashback.

   Request:  GET /api/amazon-search?q=<query>&country=<cc>
   Response: 302 to https://www.amazon.<tld>/s?k=<query>&tag=<assoc-tag>

   SAFETY: the destination host is ALWAYS an amazon.<tld> built here from
   a fixed per-country map — never a user-supplied host. So this is not an
   open redirect and needs no HMAC signing (unlike /api/go, which forwards
   arbitrary merchant URLs). The only user input is the search PHRASE,
   which is control-stripped, length-capped and URL-encoded. */

import { NextRequest, NextResponse } from "next/server";
import { wrapWithAffiliate } from "@/lib/affiliate";

/* Page country -> the Amazon marketplace that country shops. NG has no
   local Amazon, so it (and any unmapped country) falls back to amazon.com
   via Global export, matching the cross-border rules in country.ts. */
const COUNTRY_AMAZON_DOMAIN: Record<string, string> = {
  uk: "amazon.co.uk",
  us: "amazon.com",
  de: "amazon.de",
  ae: "amazon.ae",
  in: "amazon.in",
  za: "amazon.co.za",
  ng: "amazon.com",
};

const MAX_Q = 150;

/* Drop control characters (newlines/tabs from a paste, etc.) without a
   literal-control-char regex in source. */
function sanitizeQuery(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    out += code < 0x20 || code === 0x7f ? " " : ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, MAX_Q);
}

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "us").toLowerCase();
  const domain = COUNTRY_AMAZON_DOMAIN[country] ?? "amazon.com";

  /* An empty query just opens the marketplace homepage (still tagged)
     rather than an empty search-results page. */
  const q = sanitizeQuery(searchParams.get("q") || "");
  const base = q
    ? `https://www.${domain}/s?k=${encodeURIComponent(q)}`
    : `https://www.${domain}/`;

  /* Apply the per-marketplace Associates tag. No-ops cleanly if that
     marketplace's tag env isn't set yet, so the link still works
     (untagged) and lights up the moment the tag lands. */
  const tagged = wrapWithAffiliate(base, { country });

  return NextResponse.redirect(tagged, 302);
}
