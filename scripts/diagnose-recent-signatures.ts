#!/usr/bin/env tsx
/* Probe just the rows created in the last 2 hours — i.e. during the
   test run — to confirm the new buildSignature is actually firing
   on inserts. Existing rows keep their old "?|?" signatures until
   migration 0060 runs; only newly inserted rows will show the new
   format. */
try { /* @ts-expect-error */ process.loadEnvFile?.(".env.local"); } catch {}
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supa
    .from("products")
    .select("id, title, signature, brand, category, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); process.exit(1); }
  const rows = data ?? [];
  console.log(`Products created since ${since.slice(0, 19)}: ${rows.length}`);

  const sigDist = new Map<string, number>();
  for (const r of rows) {
    const k = (r.signature ?? "(NULL)") as string;
    sigDist.set(k, (sigDist.get(k) ?? 0) + 1);
  }
  const top = [...sigDist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log("\nSignature distribution (top 20):");
  for (const [k, n] of top) console.log(`  ${k.padEnd(35)} ${n}`);

  const richCount = rows.filter((r) => r.signature && !r.signature.includes("?") && r.signature.length > 0).length;
  const nullCount = rows.filter((r) => !r.signature).length;
  const badCount  = rows.filter((r) => r.signature && r.signature.includes("?")).length;
  console.log(`\nSummary among ${rows.length} fresh rows:`);
  console.log(`  Rich brand|model signatures: ${richCount} (${(100 * richCount / Math.max(1, rows.length)).toFixed(1)}%)`);
  console.log(`  NULL signatures:             ${nullCount} (${(100 * nullCount / Math.max(1, rows.length)).toFixed(1)}%)`);
  console.log(`  "?" signatures (still bad):  ${badCount} (${(100 * badCount / Math.max(1, rows.length)).toFixed(1)}%)`);
  console.log("\n10 random samples:");
  for (const r of rows.sort(() => Math.random() - 0.5).slice(0, 10)) {
    console.log(`  "${r.title.slice(0, 70).padEnd(70)}" → ${r.signature ?? "(NULL)"}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
