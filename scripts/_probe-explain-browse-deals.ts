try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  /* Run browse_deals via RPC (latency baseline) */
  const cases: Array<{ label: string; args: Record<string, unknown> }> = [
    { label: "all NG local discount", args: { p_country: "NG", p_origin: "local", p_sort: "discount", p_max_rows: 500 } },
    { label: "all UK local discount", args: { p_country: "UK", p_origin: "local", p_sort: "discount", p_max_rows: 500 } },
    { label: "all US intl",           args: { p_country: "US", p_origin: "intl",  p_sort: "discount", p_max_rows: 500 } },
    { label: "ZA local zero-discount", args: { p_country: "ZA", p_origin: "local", p_sort: "discount", p_zero_discount_only: true, p_max_rows: 500 } },
    { label: "filter by single store", args: { p_country: "UK", p_origin: "local", p_sort: "discount", p_store_ids: ["argos"], p_max_rows: 500 } },
    { label: "DE local",              args: { p_country: "DE", p_origin: "local", p_sort: "discount", p_max_rows: 500 } },
  ];
  for (const c of cases) {
    const t0 = Date.now();
    const { data, error } = await supa.rpc("browse_deals", c.args as Record<string, unknown> as never);
    const dt = Date.now() - t0;
    const n = Array.isArray(data) ? data.length : 0;
    console.log(`  ${c.label.padEnd(35)} t=${dt}ms rows=${n}${error ? ` ERROR ${error.message}` : ""}`);
  }
}
main().catch(console.error);
