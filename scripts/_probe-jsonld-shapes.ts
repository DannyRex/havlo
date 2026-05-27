try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin()!;
  const stores = ["konga", "supermart", "essenza", "healthplus", "medplus", "slot", "kara", "3chub"];
  for (const s of stores) {
    const { data } = await supa.from("offers")
      .select("url, store_id")
      .eq("store_id", s)
      .limit(1);
    if (!data?.[0]) { console.log(`[${s}] no offers`); continue; }
    const url = data[0].url;
    console.log(`\n[${s}] ${url}`);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" },
        redirect: "follow",
      });
      const html = await res.text();
      const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
      console.log(`  HTTP ${res.status}, ${html.length} bytes, ${blocks.length} JSON-LD blocks`);
      for (let i = 0; i < Math.min(blocks.length, 3); i++) {
        console.log(`  --- block ${i+1} ---`);
        console.log("  " + blocks[i][1].trim().slice(0, 600));
      }
    } catch (e: any) { console.log(`  ERROR: ${e.message}`); }
  }
}
main().catch(console.error);
