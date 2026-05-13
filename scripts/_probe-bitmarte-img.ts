try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }
  const { data } = await supa
    .from("product_best_offers")
    .select("title, image_url, url")
    .eq("store_id", "bitmarte")
    .limit(10);
  for (const r of (data as { title: string; image_url: string | null; url: string }[] | null) ?? []) {
    console.log(`title:  ${r.title.slice(0, 60)}`);
    console.log(`  img:  ${r.image_url ?? "(null)"}`);
    console.log(`  url:  ${r.url?.slice(0, 100) ?? "(null)"}`);
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
