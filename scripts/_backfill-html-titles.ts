/* Backfill: strip HTML tags from existing product titles + recompute
   title_key. Run once after the new HTML-strip cleanProductTitle ships. */
try { (process as any).loadEnvFile?.(".env.local"); } catch {/* */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const APPLY = process.argv.includes("--apply");
const HTML_TAG = /<\/?[a-z][^>]*>/gi;

function normaliseTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 120);
}

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
  const html = all.filter((r) => HTML_TAG.test(r.title));
  /* RegExp.test() with /g flag is stateful — reset between rows. */
  console.log(`${APPLY ? "▶ APPLY" : "● DRY RUN"} — html-tagged titles: ${html.length}`);
  for (const r of html.slice(0, 5)) {
    const cleaned = r.title.replace(HTML_TAG, "").replace(/\s{2,}/g, " ").trim();
    console.log(`  ${r.id.slice(0,8)} "${r.title.slice(0,80)}" → "${cleaned.slice(0,80)}"`);
  }
  if (!APPLY) { console.log("\n● dry run — pass --apply to write"); return; }

  let updated = 0;
  for (const r of html) {
    const cleaned = r.title.replace(HTML_TAG, "").replace(/\s{2,}/g, " ").trim();
    const tk = normaliseTitleKey(cleaned);
    const { error } = await supa.from("products").update({ title: cleaned, title_key: tk }).eq("id", r.id);
    if (!error) updated++;
  }
  console.log(`\n✓ updated ${updated} products`);
}
main().catch(console.error);
