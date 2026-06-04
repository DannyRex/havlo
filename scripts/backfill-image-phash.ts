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
     npx tsx scripts/backfill-image-phash.ts --rehash-all      # recompute EVERY
       # row's hash in place (used after a hash-algorithm change, e.g. the
       # Phase 2a trim). Drops the "phash IS NULL" filter and overwrites.
       # Reads from image_url, which now points at our Supabase Storage CDN
       # for every hosted product, so the whole catalog hashes from one
       # consistent source. Storage is our own infra: the per-merchant
       # politeness throttle is bypassed for it so the re-hash isn't capped
       # at 4-at-a-time.
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
const REHASH_ALL = argv.includes("--rehash-all");

/* Total concurrent fetches. Higher for a full re-hash since the source is
   our own Storage CDN (see hostParallel below), not throttled merchant CDNs. */
const TOTAL_PARALLEL = REHASH_ALL ? 48 : PARALLEL_FETCHES;

/* Our Supabase Storage CDN needs no politeness throttle. After self-hosting
   (#133) every image_url is one Storage host, so the per-merchant cap would
   choke a full re-hash to 4-at-a-time. Treat Storage as unthrottled; keep the
   polite caps for genuine merchant CDNs (brand-new, not-yet-hosted rows). */
const STORAGE_HOST_RE = /(^|\.)supabase\.co$/i;
const hostParallel = (h: string): number => (STORAGE_HOST_RE.test(h) ? TOTAL_PARALLEL : PER_HOST_PARALLEL);
const hostDelay    = (h: string): number => (STORAGE_HOST_RE.test(h) ? 0 : PER_HOST_DELAY_MS);

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
  if (s.inFlight < hostParallel(host)) {
    const delay = hostDelay(host);
    const since = Date.now() - s.lastStartMs;
    if (delay && since < delay) await new Promise((r) => setTimeout(r, delay - since));
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
  if (next) {
    const delay = hostDelay(host);
    if (delay) setTimeout(next, delay); else next();
  }
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
  for (let i = 0; i < Math.min(TOTAL_PARALLEL, jobs.length); i++) startNext();
  while (active.length > 0) await Promise.race(active);
  return results;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("Missing Supabase env"); process.exit(1); }

  /* Paginated load. Incremental mode: products with image_url but NULL phash.
     Re-hash mode (--rehash-all): EVERY product with an image_url, overwriting
     any existing hash with the freshly-computed one. */
  console.log(REHASH_ALL
    ? "Loading ALL products with an image_url for a full re-hash (overwrite in place)..."
    : "Loading products needing phash backfill...");
  const PAGE = 1000;
  type Row = { id: string; image_url: string };
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supa
      .from("products")
      .select("id, image_url")
      .not("image_url", "is", null)
      .range(from, from + PAGE - 1);
    if (!REHASH_ALL) q = q.is("image_phash", null);
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
  console.log(`Loaded ${rows.length} products${STORE_FILT ? ` (${filtered.length} after store filter)` : ""}. Concurrency: ${TOTAL_PARALLEL} total${REHASH_ALL ? " (Storage unthrottled)" : ` / ${PER_HOST_PARALLEL} per merchant host`}.`);
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

  /* Write the hashes back. Each row is a single-column UPDATE keyed by id
     (no usable bulk-upsert since we're only touching one column on existing
     rows), but we run them in CONCURRENT batches instead of one-at-a-time:
     16k sequential round-trips took ~13min and dominated a full re-hash,
     while the compute phase finished in ~2min. bigint must be stringified --
     the supabase-js client won't encode a JS bigint to PG bigint directly. */
  const WRITE_CONCURRENCY = 24;
  let updated = 0; let failed = 0; let writeDone = 0;
  for (let i = 0; i < hits.length; i += WRITE_CONCURRENCY) {
    const batch = hits.slice(i, i + WRITE_CONCURRENCY);
    await Promise.all(batch.map(async (r) => {
      const { error: e } = await supa
        .from("products")
        .update({ image_phash: r.hash!.toString() })
        .eq("id", r.productId);
      if (e) failed++; else updated++;
    }));
    writeDone = Math.min(writeDone + WRITE_CONCURRENCY, hits.length);
    if (writeDone % 2000 === 0 || writeDone === hits.length) {
      console.log(`  wrote ${writeDone}/${hits.length} (failed=${failed})`);
    }
  }
  console.log(`Wrote ${updated} phash updates. ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
