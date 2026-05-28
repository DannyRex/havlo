/* /api/alerts — create a price alert subscription.
   POST { email, productId?, query?, targetPriceNgn, country, source? }

   Fired from the PDP's "Set price alert" button. Stores the row in
   price_alerts and sends a confirmation email via Resend. The cron
   job (/api/cron/check-price-alerts) scans pending alerts daily and
   fires the trigger email when conditions match.

   At least one of productId / query is required. PDPs with a real
   product_id pass it for tight matching; live-search / curated PDPs
   pass the title as query and the cron falls back to FTS search.

   Failure-tolerance posture mirrors /api/notify-product: when the
   table isn't migrated yet, return ok:true so the user-facing form
   shows success during the rollout window. Same for missing Supabase
   admin client. */

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { sendEmail } from "@/lib/email/send";
import { priceAlertConfirmation } from "@/lib/email/templates/price-alert";
import { getCountry } from "@/lib/country";
import { formatPriceForUser } from "@/lib/utils";

interface AlertRequest {
  email?:           string;
  productId?:       string;
  query?:           string;
  productTitle?:    string;   // used in confirmation email when productId
  targetPriceNgn?:  number;
  country?:         string;
  source?:          string;
}

const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE       = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LEN = 200;
const MAX_TARGET    = 100_000_000;  // ₦100M — sanity bound

export async function POST(req: NextRequest) {
  let body: AlertRequest;
  try {
    body = (await req.json()) as AlertRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const email          = body.email?.trim().toLowerCase();
  const productId      = body.productId?.trim();
  const query          = body.query?.trim().slice(0, MAX_TITLE_LEN).toLowerCase();
  const productTitle   = body.productTitle?.trim().slice(0, MAX_TITLE_LEN) ?? "your product";
  const targetPriceNgn = body.targetPriceNgn;
  const country        = body.country?.trim().toLowerCase() ?? "ng";
  const source         = body.source?.trim() || "pdp";

  /* Validation — fail loud on anything malformed. The PDP component
     pre-validates client-side but we re-check server-side because
     the endpoint is publicly POST-able. */
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }
  if (productId && !UUID_RE.test(productId)) {
    return NextResponse.json({ ok: false, error: "Invalid productId" }, { status: 400 });
  }
  if (!productId && (!query || query.length < 2)) {
    return NextResponse.json({ ok: false, error: "productId or query required" }, { status: 400 });
  }
  if (
    typeof targetPriceNgn !== "number" ||
    !Number.isFinite(targetPriceNgn) ||
    targetPriceNgn <= 0 ||
    targetPriceNgn > MAX_TARGET
  ) {
    return NextResponse.json({ ok: false, error: "Valid target price required" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ ok: true, note: "DB not configured; request not persisted" });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  /* Insert. We deliberately DON'T upsert here — when a user creates
     a second alert at a different target price, that's a NEW row,
     not a replacement. The unique constraint dedups exact same
     (email, product/query, target) combos which IS what we want. */
  const { data, error } = await supa
    .from("price_alerts")
    .insert({
      email,
      product_id: productId || null,
      query:      productId ? null : query,
      target_ngn: targetPriceNgn,
      country,
      source,
      user_agent: userAgent,
    })
    .select("token")
    .single();

  if (error) {
    /* Duplicate alert — partial unique index fired. UX-wise this is
       a benign no-op ("you're already watching this at this price")
       so return ok:true with a hint. */
    if (/duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ ok: true, note: "Already watching this product at this price" });
    }
    /* Missing migration — fail soft so the form's success state
       still lands during rollout. */
    if (/relation .* does not exist|could not find the table.*in the schema cache/i.test(error.message)) {
      console.warn("[alerts] price_alerts table not yet migrated:", error.message);
      return NextResponse.json({ ok: true, note: "Table pending migration" });
    }
    console.error("[alerts] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save alert" }, { status: 500 });
  }

  /* Send confirmation email via waitUntil — same pattern as
     /api/notify-product so a slow Resend can't block the response. */
  const countryObj = getCountry(country);
  const targetPriceFmt = formatPriceForUser(targetPriceNgn, countryObj);
  const tmpl = priceAlertConfirmation({
    productTitle,
    targetPriceFmt,
    country,
    unsubscribeToken: data.token,
  });
  waitUntil(
    sendEmail({
      to:      email,
      subject: tmpl.subject,
      text:    tmpl.text,
      html:    tmpl.html,
      tags: [
        { name: "category", value: "price-alert-confirmation" },
        { name: "source",   value: source.replace(/[^a-z0-9_-]/gi, "_").slice(0, 50) },
      ],
    }).catch((err) => {
      console.error("[alerts] confirmation email failed:", (err as Error).message);
    }),
  );

  return NextResponse.json({ ok: true });
}
