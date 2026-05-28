#!/usr/bin/env tsx
/* Daily price-alert scan + email.

   Fires from CI on a daily schedule (.github/workflows/scrape-deals.yml
   plus a dedicated daily trigger). For each row in price_alerts where
   notified_at is null AND the current cheapest in-country offer is
   at or below target_ngn, send the trigger email via Resend and
   stamp notified_at so it doesn't re-fire.

   Only handles product_id-keyed alerts in v1. Query-only alerts
   (fallback when PDP has no product UUID) will be handled in a
   future iteration that runs the search path per-alert.

   Usage:
     # Preview without sending (counts + sample subjects only):
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/check-price-alerts.ts --dry-run

     # Send to a single email (live test):
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/check-price-alerts.ts --only=you@example.com

     # Production scan + send:
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/check-price-alerts.ts

   The script reads SUPABASE_SERVICE_ROLE_KEY + RESEND_API_KEY from
   env. Both are required workflow secrets in CI. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { getSupabaseAdmin } from "../../src/lib/providers/db-client";
import { getCountry } from "../../src/lib/country";
import { formatPriceForUser } from "../../src/lib/utils";
import { priceAlertTriggered } from "../../src/lib/email/templates/price-alert";
import { sendEmail } from "../../src/lib/email/send";

interface Args {
  dryRun: boolean;
  only:   string | null;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false, only: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--only=")) args.only = arg.slice("--only=".length).toLowerCase();
  }
  return args;
}

const SITE_URL = "https://havlo.io";
const PACE_MS_BETWEEN = 500;   // ~2 emails/sec, safe under Resend free tier

interface PendingRow {
  alert_id:            string;
  email:               string;
  product_id:          string;
  query:               string | null;
  target_ngn:          number;
  country:             string;
  token:               string;
  cheapest_ngn:        number;
  cheapest_offer_id:   string | null;
  cheapest_store_name: string | null;
}

async function main() {
  const args = parseArgs();
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("[check-price-alerts] Supabase admin client unavailable. Check SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  /* Pull pending alerts whose conditions are met. The RPC enforces
     country-aware cheapest-offer math + the target threshold. */
  const { data: pending, error } = await supa.rpc("pending_price_alerts");
  if (error) {
    console.error("[check-price-alerts] RPC error:", error.message);
    process.exit(1);
  }
  const rows = (pending ?? []) as PendingRow[];
  const filteredRows = args.only ? rows.filter((r) => r.email === args.only) : rows;

  console.log(`[check-price-alerts] ${rows.length} alerts triggered (${filteredRows.length} after --only filter)`);
  if (filteredRows.length === 0) {
    console.log("[check-price-alerts] No alerts to send. Done.");
    return;
  }

  if (args.dryRun) {
    console.log("[check-price-alerts] DRY RUN — would send:");
    for (const r of filteredRows.slice(0, 10)) {
      console.log(`  → ${r.email} · ${r.cheapest_store_name} · ₦${r.cheapest_ngn} (target ₦${r.target_ngn})`);
    }
    if (filteredRows.length > 10) console.log(`  ... and ${filteredRows.length - 10} more`);
    return;
  }

  /* Look up product titles in one bulk query so the email subject
     can carry the actual product name. The RPC doesn't return titles
     directly because it'd require an extra join on products for
     every row. */
  const productIds = Array.from(new Set(filteredRows.map((r) => r.product_id)));
  const { data: products, error: prodErr } = await supa
    .from("products")
    .select("id,title")
    .in("id", productIds);
  if (prodErr) {
    console.error("[check-price-alerts] products lookup error:", prodErr.message);
    process.exit(1);
  }
  const titleById: Record<string, string> = {};
  for (const p of (products ?? []) as Array<{ id: string; title: string }>) {
    titleById[p.id] = p.title;
  }

  /* Send the trigger emails serially with pacing, same shape as
     send-newsletter.ts. Tally sent / failed for the run summary. */
  let sent   = 0;
  let failed = 0;
  const successfulAlertIds: string[] = [];

  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i];
    const country = getCountry(row.country);
    const title = titleById[row.product_id] ?? row.query ?? "your product";
    const targetFmt = formatPriceForUser(row.target_ngn, country);
    const cheapestFmt = formatPriceForUser(row.cheapest_ngn, country);
    const productUrl = row.cheapest_offer_id
      ? `${SITE_URL}/${row.country}/p/${row.cheapest_offer_id}`
      : `${SITE_URL}/${row.country}/deals`;

    const tmpl = priceAlertTriggered({
      productTitle:    title,
      targetPriceFmt:  targetFmt,
      cheapestPriceFmt: cheapestFmt,
      storeName:       row.cheapest_store_name ?? "the store",
      productUrl,
      country:         row.country,
      unsubscribeToken: row.token,
    });

    const result = await sendEmail({
      to:      row.email,
      subject: tmpl.subject,
      text:    tmpl.text,
      html:    tmpl.html,
      tags: [
        { name: "category", value: "price-alert-triggered" },
        { name: "country",  value: row.country.toUpperCase() },
      ],
    });

    if (result.ok) {
      sent++;
      successfulAlertIds.push(row.alert_id);
    } else {
      failed++;
      console.warn(`[check-price-alerts] send failed: ${row.email} (${result.error})`);
    }

    /* Throttle. Last row skips the sleep. */
    if (i < filteredRows.length - 1) {
      await new Promise((res) => setTimeout(res, PACE_MS_BETWEEN));
    }
  }

  /* Bulk-update notified_at for everything we successfully sent.
     Avoids the case where a transient cron failure between send and
     update leaks a duplicate email next run — small risk window, but
     batching makes the failure mode predictable. */
  if (successfulAlertIds.length > 0) {
    const { error: updErr } = await supa
      .from("price_alerts")
      .update({ notified_at: new Date().toISOString(), last_checked_at: new Date().toISOString() })
      .in("id", successfulAlertIds);
    if (updErr) {
      console.error("[check-price-alerts] notified_at bulk-update error:", updErr.message);
    }
  }

  console.log(`[check-price-alerts] Done. sent=${sent} failed=${failed} total=${filteredRows.length}`);
}

main().catch((err) => {
  console.error("[check-price-alerts] Uncaught:", (err as Error).message);
  process.exit(1);
});
