/* ─────────────────────────────────────────────────────────────────
   Phase 2 — instant image perceptual-hash backfill.

   For every product with image_url set and image_phash NULL, fetches
   the image bytes, computes a 64-bit dHash via sharp, writes to
   products.image_phash. Parallel worker pool with per-host
   throttling so we're polite to merchant CDNs.

   Expected coverage:
     - ~80-90% of products that have image_url should successfully
       hash. The misses come from broken URLs, very large images
       (>5MB cap), or formats sharp can't decode.
     - On the catalog as a whole: products that lack image_url
       (mostly older ingest rows, Kara before the og:image proxy
       work) stay NULL.

   Usage:
     npx tsx scripts/backfill-image-phash.ts
     npx tsx scripts/backfill-image-phash.ts --limit=200       # smoke test
     npx tsx scripts/backfill-image-phash.ts --store=essenza   # one store
     npx tsx scripts/backfill-image-phash.ts --dry-run         # no writes
   ───────────────────────────────────────────────────────────────── */

try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }
import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { fetchAndHashImage } from "../src/lib/search/phash";

const PARALLEL_FETCHES   = 16;   // total concurrent
const PER_HOST_PARALLEL  = 4;    // max per merchant
const PER_HOST_DELAY_MS  = 200;  // min spacing per host

const argv = process.argv.slice(2);
const arg  = (n: string) => { const f = argv.find((a) => a.startsWith(`--${n}=`)); return f ? f.slice(n.length + 3) : null; };
const LIMIT      = arg("limit") ? Number(arg("limit")) : null;
const STORE_FILT = arg("store");
const DRY_RUN    = argv.includes("--dry-run");

/* ── Per-host throttling (mirrors backfill-identifiers-jsonld.ts) ── */
interface HostState { inFlight: number; lastStartMs: number; queue: Array<() => void> }
const hostStates = new Map<string, HostState>();
function getHostState(h: string): HostState {
  let s = hostStates.get(h);
  if (!s) { s = { inFlight: 0, lastStartMs: 0, queue: [] }; hostStates.set(h, s); }
  return s;
}
async function acquireHostSlot(host: string): Promise<void> {
  const s = getHostState(host);
  if (s.inFlight < PER_HOST_PARALLEL) {
    const since = Date.now() - s.lastStartMs;
    if (since < PER_HOST_DELAY_MS) await new Promise((r) => setTimeout(r, PER_HOST_DELAY_MS - since));
    s.inFlight++; s.lastStartMs = Date.now(); return;
  }
  await new Promise<void>((resolve) => {
    s.queue.push(() => { s.inFlight++; s.lastStartMs = Date.now(); resolve(); });
  });
}
function releaseHostSlot(host: string) {
  const s = getHostState(host);
  s.inFlight--;
  const next = s.queue.shift();
  if (next) setTimeout(next, PER_HOST_DELAY_MS);
}

interface Job { productId: string; imageUrl: string }
interface JobResult { productId: string; hash: bigint | null }

async function processJob(job: Job): Promise<JobResult> {
  let host: string;
  try { host = new URL(job.imageUrl).hostname; } catch { return { productId: job.productId, hash: null }; }
  await acquireHostSlot(host);
  try {
    /* Skip Kara product-page URLs entirely — they require og:image
       resolution which is done by the img-proxy at request time,
       not at backfill time. The product hash would be the hash of
       the HTML page (junk). */
    if (host === "kara.com.ng") return { productId: job.productId, hash: null };
    const hash = await fetchAndHashImage(job.imageUrl);
    return { productId: job.productId, hash };
  } finally {
    releaseHostSlot(host);
  }
}

async function runPool(jobs: Job[], onProgress: (done: number, total: number, hits: number) => void): Promise<JobResult[]> {
  const results: JobResult[] = [];
  let cursor = 0;
  let hits = 0;
  const active: Promise<void>[] = [];
  const startNext = (): boolean => {
    if (cursor >= jobs.length) return false;
    const j = jobs[cursor++];
    const p = processJob(j).then((r) => {
      results.push(r);
      if (r.hash !== null) hits++;
      onProgress(results.length, jobs.length, hits);
      const i = active.indexOf(p); if (i >= 0) active.splice(i, 1);
      startNext();
    });
    active.push(p);
    return true;
  };
  for (let i = 0; i < Math.min(PARALLEL_FETCHES, jobs.length); i++) startNext();
  while (active.length > 0) await Promise.race(active);
  return results;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("Missing Supabase env"); process.exit(1); }

  /* Paginated load — products with image_url but NULL phash. */
  console.log("Loading products needing phash backfill...");
  const PAGE = 1000;
  type Row = { id: string; image_url: string };
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supa
      .from("products")
      .select("id, image_url")
      .not("image_url", "is", null)
      .is("image_phash", null)
      .range(from, from + PAGE - 1);
    if (LIMIT && rows.length + PAGE > LIMIT) q = q.limit(LIMIT - rows.length);
    const { data: page, error } = await q;
    if (error) { console.error("Fetch failed:", error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    rows.push(...(page as Row[]));
    if (page.length < PAGE) break;
    if (LIMIT && rows.length >= LIMIT) break;
  }

  /* Optional --store filter — pulls offers to narrow by store_id.
     Loaded separately because the inner-join syntax above is heavier
     and store filtering is rare (mostly used for diagnostics). */
  let filtered = rows;
  if (STORE_FILT) {
    const { data: storeProducts } = await supa
      .from("offers")
      .select("product_id")
      .eq("store_id", STORE_FILT);
    const ids = new Set((storeProducts ?? []).map((p) => p.product_id));
    filtered = rows.filter((r) => ids.has(r.id));
  }

  if (filtered.length === 0) { console.log("Nothing to backfill."); return; }
  const jobs: Job[] = filtered.map((r) => ({ productId: r.id, imageUrl: r.image_url }));
  console.log(`Loaded ${rows.length} products${STORE_FILT ? ` (${filtered.length} after store filter)` : ""}. Concurrency: ${PARALLEL_FETCHES} total / ${PER_HOST_PARALLEL} per host.`);
  if (DRY_RUN) console.log("(dry-run: will NOT write to DB)");

  const startMs = Date.now();
  const results = await runPool(jobs, (done, total, hits) => {
    if (done % 100 === 0 || done === total) {
      const rate = (done / ((Date.now() - startMs) / 1000)).toFixed(1);
      console.log(`  ${done}/${total} processed, ${hits} hashed, ${rate}/s`);
    }
  });

  const hits = results.filter((r) => r.hash !== null);
  console.log(`\nProcessed ${results.length}. Hashed ${hits.length} (${((hits.length / results.length) * 100).toFixed(1)}%).`);

  if (DRY_RUN) { console.log("Dry-run: skipping DB writes."); return; }

  /* Write in small batches. Each row is one column UPDATE so we can't
     usefully upsert; just sequential per-row UPDATEs. bigint needs
     `as` cast through string because Supabase JS client doesn't
     natively encode JS bigint to PG bigint without explicit
     stringification. */
  let updated = 0; let failed = 0;
  for (const r of hits) {
    const { error: e } = await supa
      .from("products")
      .update({ image_phash: r.hash!.toString() })
      .eq("id", r.productId);
    if (e) failed++; else updated++;
  }
  console.log(`Wrote ${updated} phash updates. ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
