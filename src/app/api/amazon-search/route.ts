/* /api/amazon-search — outbound to a pasted Amazon product link.
   ──────────────────────────────────────────────────────────────────
   A shopper pastes an Amazon product link on the /[country]/amazon page;
   this sends them to that exact product on Amazon with our Associates tag
   applied, so the purchase qualifies under the affiliate relationship that
   funds cashback. No keyword search, no Havlo compare detour.

   Request:  GET /api/amazon-search?url=<encoded amazon product url>&country=<cc>
   Response: 302 to the tagged Amazon URL.

   SAFETY: only ever redirects to an Amazon host. The pasted url is parsed
   and its host is checked against the Amazon allowlist; anything else (or
   an unparseable value) falls back to the shopper's Amazon marketplace
   homepage. So this can never be turned into an open redirect, and no HMAC
   signing is needed (unlike /api/go, which forwards arbitrary hosts). */

import { NextRequest, NextResponse } from "next/server";
import { wrapWithAffiliate } from "@/lib/affiliate";

/* Page country -> the Amazon marketplace homepage used as the fallback when
   the pasted url isn't a usable Amazon link. */
const COUNTRY_AMAZON_DOMAIN: Record<string, string> = {
  uk: "amazon.co.uk",
  us: "amazon.com",
  de: "amazon.de",
  ae: "amazon.ae",
  in: "amazon.in",
  za: "amazon.co.za",
  ng: "amazon.com",
};

/* Hosts we will redirect to: any amazon.<tld>, plus Amazon's own link
   shorteners. Never anything else. */
function isAmazonHost(host: string): boolean {
  const h = host.toLowerCase();
  return /(^|\.)amazon\.[a-z.]{2,}$/.test(h) || h === "amzn.to" || h === "a.co";
}

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "us").toLowerCase();
  const home = `https://www.${COUNTRY_AMAZON_DOMAIN[country] ?? "amazon.com"}/`;

  const raw = (searchParams.get("url") || "").trim();
  let target = home;
  if (raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (isAmazonHost(u.host)) target = u.toString();
    } catch {
      /* unparseable -> fall back to the marketplace homepage */
    }
  }

  /* Apply the per-marketplace Associates tag (no-ops cleanly when that
     marketplace's tag env isn't set; the link still works). */
  const tagged = wrapWithAffiliate(target, { country });
  return NextResponse.redirect(tagged, 302);
}
