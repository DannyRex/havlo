#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Time-to-live sweep — marks offers in_stock=false when they
   haven't been touched in N days, regardless of source.

   Why this exists: ingestDeals() runs a per-store sweep ONLY when
   the caller passes `sweepScope: { store: ... }` (full-catalog
   guarantee). Today only ingest-scraped.ts does that. The other
   ingest paths — ingest-uk-retailers.ts (per-SKU SerpAPI),
   ingest-providers.ts (per-category SerpAPI), ingest-curated-
   targets.ts, and the (paused) live-search write-back — DON'T
   pass sweepScope, so their offers can rot indefinitely if the
   merchant delists the SKU.

   This script closes the gap with a TTL fallback. Any offer with
   last_seen_at older than the threshold gets flipped to
   in_stock=false. Conservative threshold (default 14 days) so a
   scraper hiccup or temporary outage doesn't nuke a healthy
   catalogue. Re-runnable safely — already-flipped rows aren't
   touched again.

   Usage:
     npx tsx scripts/sweep-stale-offers.ts                   # dry-run, 14d
     npx tsx scripts/sweep-stale-offers.ts --apply           # apply, 14d
     npx tsx scripts/sweep-stale-offers.ts --apply --days=7  # apply, 7d
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

interface CliArgs { apply: boolean; days: number; }

function parseArgs(): CliArgs {
  const apply = process.argv.includes("--apply");
  let days = 14;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--days=")) {
      const n = parseInt(arg.slice("--days=".length), 10);
      if (Number.isFinite(n) && n > 0) days = n;
    }
  }
  return { apply, days };
}

async function main() {
  const { apply, days } = parseArgs();
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase admin client unavailable. Check .env.local");
    process.exit(1);
  }

  /* Threshold = now - N days. Anything with last_seen_at older than
     this and currently in_stock=true is a stale offer. */
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  console.log(`▶ TTL sweep (${apply ? "APPLY" : "DRY-RUN"}): offers not seen since ${threshold}`);
  console.log("");

  /* Per-store breakdown so we can see which sources are leaking
     stale rows. Pulls store_id + last_seen_at for any candidate row,
     groups, reports. Cap at 5000 candidates per run to keep the
     payload small — if there's more than that, the cron is too
     slow and we should investigate before nuking thousands at once. */
  type Row = { store_id: string; last_seen_at: string };
  const candidates: Row[] = [];
  const PAGE = 1000;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supa
      .from("offers")
      .select("store_id, last_seen_at")
      .lt("last_seen_at", threshold)
      .eq("in_stock", true)
      .range(i * PAGE, (i + 1) * PAGE - 1);
    if (error) {
      console.error("✗ candidate scan failed:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    candidates.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }

  if (candidates.length === 0) {
    console.log("✓ No stale offers. Catalog is current.");
    return;
  }

  const byStore = new Map<string, number>();
  for (const r of candidates) {
    byStore.set(r.store_id, (byStore.get(r.store_id) ?? 0) + 1);
  }
  const sorted = Array.from(byStore.entries()).sort((a, b) => b[1] - a[1]);

  console.log(`Stale candidates (${candidates.length} total):`);
  for (const [store, n] of sorted) {
    console.log(`  ${n.toString().padStart(5)} × ${store}`);
  }
  console.log("");

  if (!apply) {
    console.log(`→ Dry-run complete. Re-run with --apply to flip ${candidates.length} offers to in_stock=false.`);
    return;
  }

  /* Apply in batches to stay under the Postgres statement timeout.
     A single catalog-wide UPDATE timed out (Jul 2026 cron failure:
     "canceling statement due to statement timeout") once the stale
     backlog grew past a few thousand rows — the previous version
     flipped every candidate in one statement. Batching by primary key
     keeps each statement small and fast; and because every flipped row
     drops out of the in_stock=true filter, re-selecting the first page
     each pass walks the entire backlog with no advancing offset. This
     also removes the old 5000-row reporting cap as a hidden ceiling on
     what actually gets swept. */
  const BATCH = 1000;
  const MAX_BATCHES = 500;         // safety cap: 500k offers/run
  let flipped = 0;
  for (let pass = 0; pass < MAX_BATCHES; pass++) {
    const { data: batch, error: selErr } = await supa
      .from("offers")
      .select("id")
      .lt("last_seen_at", threshold)
      .eq("in_stock", true)
      .order("last_seen_at", { ascending: true })
      .limit(BATCH);
    if (selErr) {
      console.error("✗ TTL sweep batch scan failed:", selErr.message);
      process.exit(1);
    }
    if (!batch || batch.length === 0) break;
    const ids = (batch as { id: string }[]).map((r) => r.id);
    const { error: updErr } = await supa
      .from("offers")
      .update({ in_stock: false })
      .in("id", ids);
    if (updErr) {
      console.error("✗ TTL sweep failed:", updErr.message);
      process.exit(1);
    }
    flipped += ids.length;
    console.log(`  …flipped ${flipped}`);
    if (ids.length < BATCH) break;
  }
  console.log(`✓ Flipped ${flipped} offers to in_stock=false.`);

  /* Refresh the cheapest-offer matview (QA Jun 2026 BLOCKER fix).
     product_best_offers reads from mv_cheapest_offer_usd (0079; FX-
     normalized cheapest pick), which only recomputed on the post-dedup
     cron, never after THIS TTL sweep.
     So an offer flipped OOS here stayed the "cheapest in-stock" row in
     the matview until the next dedup run, surfacing sold-out best-
     prices on /deals and PDPs (11.1% of best-prices measured stale).
     Refreshing here recomputes the cheapest STILL-in-stock offer per
     product (or drops the product when none remain), so the flip takes
     effect immediately. Non-concurrent refresh briefly AccessExclusive-
     locks the matview, but this sweep runs Sunday 04:00 UTC (off-peak),
     matching the lock-timing rationale of the ingest crons. */
  const { error: refreshErr } = await supa.rpc("refresh_cheapest_offers");
  if (refreshErr) {
    console.error("✗ matview refresh failed:", refreshErr.message);
    process.exit(1);
  }
  console.log("✓ Refreshed cheapest-offer matview (FX-normalized).");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
