try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  const PAGE = 1000;
  type R = { id: string; title: string };
  const all: R[] = [];
  let from = 0;
  while (true) {
    const { data } = await supa.from("products").select("id, title").range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as R[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const html = all.filter((r) => /<[a-z][^>]*>/i.test(r.title));
  console.log(`html-in-title: ${html.length}`);
  for (const r of html.slice(0, 12)) {
    console.log(`  ${r.id.slice(0,8)} ${r.title.slice(0, 120)}`);
  }
}
main().catch(console.error);
