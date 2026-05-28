try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin()!;
  const { data } = await supa.from("products")
    .select("id, title, gtin, mpn, google_shopping_id, image_phash")
    .in("id", [
      "1bc912c3-986a-4e30-83aa-a32c885965fe",  // anchor (M4 16")
      "0d283fee-e22b-4a90-ac92-b7822e04075c",  // M5 14" leak candidate (jumbo-ae)
      "d72de9a3-bcfb-406f-8e31-d9aabccb0820",  // M5 14" alt
      "87fb534e-5fea-48a5-a834-b971561c4070",  // M4 short title
    ]);
  for (const r of (data ?? []) as any[]) {
    console.log(`${r.id} title="${r.title.slice(0,50)}"`);
    console.log(`  gtin=${r.gtin} mpn=${r.mpn} gsh=${r.google_shopping_id} phash=${r.image_phash}`);
  }
}
main().catch(console.error);
