try { process.loadEnvFile?.(".env.local"); } catch {}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
async function main() {
  const supa = getSupabaseAdmin()!;
  const checks = [
    { col: "image_phash",     phase: "Phase 2 (migration 0050)" },
    { col: "title_embedding", phase: "Phase 3 (migration 0051)" },
  ];
  for (const c of checks) {
    const { error } = await supa.from("products").select(c.col).limit(1);
    console.log(`${c.phase}: ${error ? "NOT APPLIED — " + error.message.split(".")[0] : "applied ✓"}`);
  }
  const { error: mdErr } = await supa.from("match_decisions").select("anchor_id").limit(1);
  console.log(`Phase 4 (migration 0052): ${mdErr ? "NOT APPLIED — " + mdErr.message.split(".")[0] : "applied ✓"}`);
}
main();
