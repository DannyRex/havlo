try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  for (const store of ["threechub", "konga", "currys"]) {
    const { data } = await supa.from("offers").select("id, product_id, url, last_seen_at")
      .eq("store_id", store).limit(2000);
    if (!data) continue;
    const byPid = new Map<string, Array<{ id: string; url: string; ls: string }>>();
    for (const r of (data as Array<{ id: string; product_id: string; url: string; last_seen_at: string }>)) {
      if (!byPid.has(r.product_id)) byPid.set(r.product_id, []);
      byPid.get(r.product_id)!.push({ id: r.id, url: r.url, ls: r.last_seen_at });
    }
    /* Pick the worst */
    const sorted = Array.from(byPid.entries()).sort((a, b) => b[1].length - a[1].length);
    const [pid, urls] = sorted[0];
    console.log(`\n=== ${store} :: worst product ${pid.slice(0, 8)} with ${urls.length} offers ===`);
    const canonicalCount = new Map<string, number>();
    for (const u of urls) {
      const can = u.url.split("?")[0];
      canonicalCount.set(can, (canonicalCount.get(can) ?? 0) + 1);
    }
    console.log(`  unique canonical URLs: ${canonicalCount.size}`);
    /* Show 3 unique full URLs to see what's different */
    const seen = new Set<string>();
    let shown = 0;
    for (const u of urls) {
      if (!seen.has(u.url)) {
        seen.add(u.url);
        console.log(`  full: ${u.url}`);
        if (++shown >= 4) break;
      }
    }
  }
}
main().catch(console.error);
