#!/usr/bin/env tsx
/* One-shot verification that migration 0015 is applied and wired up:
     1. outbound_clicks table exists + writable
     2. popular_products(30) RPC is callable
     3. A test click round-trips end-to-end (insert → RPC sees it)
   Auto-cleans up the test row. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no supa"); process.exit(1); }

  /* 1. outbound_clicks table */
  const { count, error: tableErr } = await supa
    .from("outbound_clicks")
    .select("*", { count: "exact", head: true });
  if (tableErr) {
    console.error("✗ outbound_clicks table missing or unreadable:", tableErr.message);
    console.error("  → migration 0015 may not be applied yet");
    process.exit(1);
  }
  console.log(`✓ outbound_clicks table exists (current rows: ${count ?? 0})`);

  /* 2. popular_products RPC */
  const { data: rpc, error: rpcErr } = await supa.rpc("popular_products", { days_back: 30 });
  if (rpcErr) {
    console.error("✗ popular_products RPC failed:", rpcErr.message);
    process.exit(1);
  }
  console.log(`✓ popular_products(30) callable (rows: ${(rpc ?? []).length})`);

  /* 3. End-to-end: pick a real offer, log a click, confirm the RPC
        sees the new aggregation, clean up. */
  const { data: offer } = await supa
    .from("offers")
    .select("id, product_id")
    .eq("in_stock", true)
    .limit(1)
    .maybeSingle();
  if (!offer?.id) {
    console.warn("○ no in-stock offer to test against — skipping round-trip check");
    return;
  }

  const { error: insErr } = await supa
    .from("outbound_clicks")
    .insert({ deal_id: offer.id, query: "verify-popularity", position: 0, mode: "verify" });
  if (insErr) {
    console.error("✗ click insert failed:", insErr.message);
    process.exit(1);
  }
  console.log(`✓ click insert succeeded (deal_id = offer.id ${(offer.id as string).slice(0, 8)}…)`);

  const { data: rpcAfter } = await supa.rpc("popular_products", { days_back: 30 });
  const found = (rpcAfter ?? []).find((r: { product_id: string }) => r.product_id === offer.product_id);
  if (found) {
    console.log(`✓ popular_products picks up the click (product clicks: ${found.clicks})`);
  } else {
    console.warn(`○ RPC didn't surface the test product — check the COALESCE join`);
  }

  /* Cleanup the test row so it doesn't pollute real popularity. */
  await supa.from("outbound_clicks").delete().eq("query", "verify-popularity");
  console.log("✓ test row cleaned up");
}
main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
