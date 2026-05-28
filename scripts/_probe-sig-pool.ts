try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin()!;
  /* All products sharing the loose anchor signature */
  const { data } = await supa.from("products")
    .select("id, title, signature")
    .eq("signature", "apple|macbook pro");
  console.log(`Products with sig="apple|macbook pro": ${data?.length ?? 0}`);
  for (const r of (data ?? []) as Array<{ id: string; title: string }>) {
    console.log(`  ${r.id} "${r.title.slice(0,75)}"`);
  }
}
main().catch(console.error);
