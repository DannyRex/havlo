/* ─────────────────────────────────────────────────────────────────
   Phase 3 — title embedding backfill via OpenAI.

   For every product with title_embedding NULL, fetches a 1536-dim
   embedding via text-embedding-3-small and writes it to
   products.title_embedding (pgvector column added in migration 0051).

   Cost: ~$0.007 to embed all 12k titles (at 0.02 USD per 1M tokens,
   each title ~30 tokens).
   Time: ~3-5 minutes via 100-title batches (~50 batches × ~3s/batch).

   Usage:
     npx tsx scripts/backfill-title-embeddings.ts
     npx tsx scripts/backfill-title-embeddings.ts --limit=500
     npx tsx scripts/backfill-title-embeddings.ts --dry-run
   ───────────────────────────────────────────────────────────────── */

try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { embedTitles, vectorToPg } from "../src/lib/search/embeddings";

const BATCH_SIZE = 100;   // OpenAI accepts up to 2048; 100 is a good round-trip cost trade-off

const argv = process.argv.slice(2);
const arg = (n: string) => { const f = argv.find((a) => a.startsWith(`--${n}=`)); return f ? f.slice(n.length + 3) : null; };
const LIMIT   = arg("limit") ? Number(arg("limit")) : null;
const DRY_RUN = argv.includes("--dry-run");

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("Missing Supabase env"); process.exit(1); }

  /* Paginated load. The check is `title_embedding IS NULL` so we
     resume gracefully on subsequent runs without re-embedding. */
  console.log("Loading products needing embeddings...");
  const PAGE = 1000;
  type Row = { id: string; title: string };
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supa
      .from("products")
      .select("id, title")
      .is("title_embedding", null)
      .range(from, from + PAGE - 1);
    if (LIMIT && rows.length + PAGE > LIMIT) q = q.limit(LIMIT - rows.length);
    const { data: page, error } = await q;
    if (error) { console.error("Fetch failed:", error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    rows.push(...(page as Row[]));
    if (page.length < PAGE) break;
    if (LIMIT && rows.length >= LIMIT) break;
  }

  if (rows.length === 0) { console.log("Nothing to embed."); return; }
  console.log(`Loaded ${rows.length} products. Batch size ${BATCH_SIZE}.${DRY_RUN ? " (dry-run)" : ""}`);

  const startMs = Date.now();
  let totalEmbedded = 0;
  let totalWritten  = 0;
  let totalFailed   = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const embeddings = await embedTitles(batch.map((r) => r.title));

    const successes = embeddings.filter((e) => e !== null).length;
    totalEmbedded += successes;

    if (!DRY_RUN && successes > 0) {
      /* Per-row UPDATE — Supabase JS bulk update doesn't support
         different values per row in a single call, so we serialize.
         Each row's embedding is sent as the pgvector-string format
         "[0.1,0.2,...]" via vectorToPg(). */
      for (let j = 0; j < batch.length; j++) {
        const emb = embeddings[j];
        if (!emb) continue;
        const { error } = await supa
          .from("products")
          .update({ title_embedding: vectorToPg(emb) })
          .eq("id", batch[j].id);
        if (error) totalFailed++;
        else totalWritten++;
      }
    }

    const elapsed = (Date.now() - startMs) / 1000;
    const rate = ((i + batch.length) / elapsed).toFixed(1);
    console.log(`  ${i + batch.length}/${rows.length} processed, ${totalEmbedded} embedded${DRY_RUN ? "" : `, ${totalWritten} written`}, ${rate} rows/s`);
  }

  const totalSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\nDone in ${totalSec}s. Embedded ${totalEmbedded}/${rows.length}, wrote ${totalWritten}, ${totalFailed} write-failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
