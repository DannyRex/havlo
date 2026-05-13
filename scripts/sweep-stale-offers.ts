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

  /* Apply: single UPDATE statement covers every candidate. */
  const { error: updErr } = await supa
    .from("offers")
    .update({ in_stock: false })
    .lt("last_seen_at", threshold)
    .eq("in_stock", true);
  if (updErr) {
    console.error("✗ TTL sweep failed:", updErr.message);
    process.exit(1);
  }
  console.log(`✓ Flipped ${candidates.length} offers to in_stock=false.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
