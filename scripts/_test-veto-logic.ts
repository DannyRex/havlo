try { process.loadEnvFile?.(".env.local"); } catch {}
import {
  isLikelySameProduct,
  extractRequiredModelTokens,
  extractRequiredNumbers,
  extractVariantTokens,
} from "../src/lib/search/query-understanding";
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const PAIRS = [
  { a: "Apple MacBook Pro M4", c: "Apple MacBook Pro M3" },
  { a: "Apple MacBook Pro M4", c: "Apple MacBook Air M4" },
  { a: "Apple MacBook Pro M4", c: "Apple MacBook Air 15-inch M4 chip" },
  { a: "Samsung Galaxy A17 5G", c: "Samsung Galaxy A15 5G" },
  { a: "Samsung Galaxy A17 5G", c: "Samsung Galaxy A57 5G" },
  { a: "Sony WH-1000XM5", c: "Sony WH-1000XM4" },
  { a: "Apple iPhone 15", c: "Apple iPhone 14" },
  { a: "Apple iPhone 15", c: "Apple iPhone 15 Pro" },
];

async function main() {
  console.log("=== Token extraction + sync gate verdicts ===\n");
  for (const p of PAIRS) {
    const aN = extractRequiredNumbers(p.a);
    const cN = extractRequiredNumbers(p.c);
    const aM = extractRequiredModelTokens(p.a);
    const cM = extractRequiredModelTokens(p.c);
    const aV = extractVariantTokens(p.a);
    const cV = extractVariantTokens(p.c);
    const sync = isLikelySameProduct(
      { title: p.a, brand: "apple", priceNgn: 1_000_000 },
      { title: p.c, brand: "apple", priceNgn: 1_000_000 },
    );
    console.log(`A: "${p.a}"`);
    console.log(`C: "${p.c}"`);
    console.log(`  anchor numbers=[${aN.join(",")}] models=[${aM.join(",")}] variants=[${aV.join(",")}]`);
    console.log(`  candid numbers=[${cN.join(",")}] models=[${cM.join(",")}] variants=[${cV.join(",")}]`);
    console.log(`  sync isLikelySameProduct → ${sync}`);
    console.log("");
  }

  /* Also check match_decisions cache for these pairs in production. */
  console.log("\n=== match_decisions cache count + recent entries ===\n");
  const supa = getSupabaseAdmin()!;
  const { count } = await supa.from("match_decisions").select("*", { count: "exact", head: true });
  console.log(`Total cached decisions: ${count}`);
  const { data: recent } = await supa.from("match_decisions")
    .select("anchor_id, candidate_id, decision, confidence, decided_at")
    .order("decided_at", { ascending: false })
    .limit(10);
  console.log(`\nRecent decisions:`);
  for (const d of recent ?? []) {
    console.log(`  ${d.decision}/${d.confidence}  ${d.anchor_id.slice(0,8)}↔${d.candidate_id.slice(0,8)}  ${d.decided_at}`);
  }
}
main().catch(console.error);
