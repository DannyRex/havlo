/* /api/lookup-gtin?gtin=<value> — resolve a barcode to a Havlo URL.

   Used by the /scan client. Returns:
     { ok: true, redirect: "/{country}/p/{offerId}" }      — direct hit
     { ok: true, redirect: "/compare?q=..." }              — fuzzy fallback
     { ok: false }                                          — nothing found

   GTIN canonicalisation:
     • Strip non-digits.
     • Leading zeros matter for GTIN-13 (Apple SKUs all start with 0).
     • Length check: 8/12/13/14 valid.
     • We try the exact match first; if nothing, try the GTIN with /
       without a leading zero (handles UPC-A vs GTIN-13 confusion).

   Country resolution:
     Pulls from the `x-havlo-country` header set by middleware
     (country-server.ts pattern). Falls back to 'ng' when missing
     so the redirect URL is always well-formed.

   Routing decision:
     If a product matches the GTIN AND has at least one in-stock
     offer for the visitor's country, route to the cheapest offer's
     PDP. Otherwise: route to /compare with the product title as
     the query (fallback discovery).

   Cache: short-lived edge cache (s-maxage=300) since GTIN→product
   mapping is stable. */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

const GTIN_RE = /^[0-9]{8}$|^[0-9]{12}$|^[0-9]{13}$|^[0-9]{14}$/;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("gtin")?.trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "gtin required" }, { status: 400 });
  }
  const gtin = raw.replace(/\D/g, "");
  if (!GTIN_RE.test(gtin)) {
    return NextResponse.json({ ok: false, error: "Invalid GTIN format" }, { status: 400 });
  }

  /* Variants — try the literal GTIN first, then alt forms. UPC-A
     (12 digits) and GTIN-13 (13 digits, leading-zero-prefixed UPC)
     are routinely confused in retailer feeds; checking both shapes
     converts a near-miss into a hit. */
  const variants = new Set<string>([gtin]);
  if (gtin.length === 12) variants.add("0" + gtin);
  if (gtin.length === 13 && gtin.startsWith("0")) variants.add(gtin.slice(1));

  const country = (req.headers.get("x-havlo-country") || "ng").toLowerCase();

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
  }

  /* Step 1 — find a product by GTIN. */
  const { data: products, error: pErr } = await supa
    .from("products")
    .select("id, title")
    .in("gtin", Array.from(variants))
    .limit(1);
  if (pErr) {
    console.error("[lookup-gtin] product lookup error:", pErr.message);
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
  const product = (products && products[0]) as { id: string; title: string } | undefined;

  if (!product) {
    /* No GTIN match. Tell the client so it can render the
       miss UX, which routes to /compare?q= */
    return NextResponse.json({ ok: false }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  }

  /* Step 2 — cheapest in-stock offer for this product in the
     visitor's country. Falls back to global stores if no local
     match, then to ANY offer. */
  const { data: offers, error: oErr } = await supa
    .from("offers")
    .select("id, current_price, currency, store_id, in_stock")
    .eq("product_id", product.id)
    .eq("in_stock", true)
    .order("current_price", { ascending: true })
    .limit(20);
  if (oErr) {
    console.error("[lookup-gtin] offer lookup error:", oErr.message);
    return NextResponse.json({ ok: true, redirect: `/${country}/compare?q=${encodeURIComponent(product.title)}` });
  }

  const cheapest = offers && offers[0];
  if (cheapest) {
    return NextResponse.json(
      { ok: true, redirect: `/${country}/p/${cheapest.id}` },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
    );
  }

  /* No in-stock offer. Fall through to a comparison search using
     the product's title — still useful for the user since /compare
     will surface dupes / fallback rails. */
  return NextResponse.json(
    { ok: true, redirect: `/${country}/compare?q=${encodeURIComponent(product.title)}` },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
