try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("offers").select("url").eq("store_id", "asos").limit(1);
  const url = data![0].url;
  console.log("URL:", url);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" },
    redirect: "follow",
  });
  console.log("Status:", res.status, "size:", (await res.clone().text()).length);
  const html = await res.text();
  const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  console.log(`${blocks.length} JSON-LD blocks`);
  for (let i = 0; i < blocks.length; i++) {
    console.log(`--- block ${i+1} (${blocks[i][1].length} bytes) ---`);
    console.log(blocks[i][1].trim().slice(0, 800));
  }
}
main().catch(console.error);
