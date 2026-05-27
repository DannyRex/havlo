try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("offers").select("url").eq("store_id", "threechub").limit(2);
  for (const r of data ?? []) {
    console.log(`\n${r.url}`);
    const res = await fetch(r.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" },
      redirect: "follow",
    });
    const html = await res.text();
    console.log(`  HTTP ${res.status}, ${html.length} bytes`);
    const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    console.log(`  ${blocks.length} JSON-LD blocks`);
    for (let i = 0; i < Math.min(blocks.length, 2); i++) {
      console.log(`  --- block ${i+1} ---`);
      console.log("  " + blocks[i][1].trim().slice(0, 500));
    }
  }
}
main().catch(console.error);
