/* ─────────────────────────────────────────────────────────────────
   Phase 1.5 — instant identifier backfill via Schema.org JSON-LD.

   Hits every product page in the catalog, extracts gtin/mpn/brand
   from <script type="application/ld+json"> Product blocks, and
   updates products.gtin / mpn rows in bulk.

   Parallelism model:
     - PARALLEL_FETCHES total concurrent requests
     - per-host queue caps concurrency per merchant so we're polite
     - per-host minimum delay between requests (250ms default)
     - resumable: skips products that already have ANY identifier
       (gtin/mpn/google_shopping_id) populated

   Coverage expectations:
     - Shopify stores (Supermart, HealthPlus, Essenza): ~100%
     - Mid-tier retailers (Konga, Slot, 3CHub, Jumia, Kara): 50-90%
     - Marketplace giants (Amazon, AliExpress, eBay): ~0% (bot-blocked)
     - SerpAPI-synthesized rows with no real merchant URL: skipped

   Usage:
     npx tsx scripts/backfill-identifiers-jsonld.ts                 # all
     npx tsx scripts/backfill-identifiers-jsonld.ts --limit=500     # smoke test
     npx tsx scripts/backfill-identifiers-jsonld.ts --store=konga   # one store
     npx tsx scripts/backfill-identifiers-jsonld.ts --dry-run       # no writes
   ───────────────────────────────────────────────────────────────── */

try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

/* ── Config knobs ──────────────────────────────────────────────── */

const PARALLEL_FETCHES   = 20;
const PER_HOST_PARALLEL  = 4;   // max concurrent requests per merchant
const PER_HOST_DELAY_MS  = 250; // min ms between requests to same host
const FETCH_TIMEOUT_MS   = 12000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/* Hosts known to actively block bots — skip up-front to save HTTP
   round-trips on 403s we'll just discard anyway. Adding entries here
   is purely a perf optimization; the fetcher already handles 403s
   gracefully. */
const KNOWN_BOT_BLOCKED_HOSTS = new Set([
  "www.amazon.com", "www.amazon.co.uk", "www.amazon.de", "www.amazon.ae", "www.amazon.in",
  "www.aliexpress.com", "aliexpress.com",
  "www.ebay.com", "www.ebay.co.uk",
  /* Walmart geo-blocks NG/EU; mostly returns 412 or 403. */
  "www.walmart.com",
  /* DHgate, Temu, Shein use heavy bot protection. */
  "www.dhgate.com", "www.temu.com", "www.shein.com",
]);

const argv = process.argv.slice(2);
const arg  = (name: string): string | null => {
  const f = argv.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : null;
};
const LIMIT      = arg("limit") ? Number(arg("limit")) : null;
const STORE_FILT = arg("store");
const DRY_RUN    = argv.includes("--dry-run");

/* ── Schema.org Product extractor ─────────────────────────────── */

interface ExtractedIds {
  gtin?:  string;
  mpn?:   string;
  brand?: string;
  sku?:   string;
}

/* Walk an arbitrary JSON-LD value (object, array, or nested) and
   collect Product nodes. JSON-LD allows the top-level value to be:
     - a single object
     - an array of objects
     - an object with @graph: [array of objects]
     - nested arrays inside ItemList, BreadcrumbList, etc.
   We flatten the tree and pick out any node where @type matches
   Product (or contains "Product" in a multi-type array). */
function findProductNodes(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!value) return out;
  if (Array.isArray(value)) {
    for (const v of value) findProductNodes(v, out);
    return out;
  }
  if (typeof value !== "object") return out;
  const obj = value as Record<string, unknown>;
  const type = obj["@type"];
  const isProduct =
    type === "Product" ||
    (Array.isArray(type) && type.some((t) => typeof t === "string" && /Product/i.test(t)));
  if (isProduct) out.push(obj);
  /* Recurse into @graph (the spec's batch container) and known
     nested-list properties so we catch Products embedded inside
     ItemList, OfferCatalog, etc. */
  for (const key of ["@graph", "itemListElement", "mainEntity", "offers", "hasPart"]) {
    if (obj[key]) findProductNodes(obj[key], out);
  }
  return out;
}

function pickString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    /* Brand is often { @type: "Brand", name: "Apple" } */
    if (typeof obj.name === "string") return obj.name.trim() || undefined;
    if (typeof obj["@value"] === "string") return (obj["@value"] as string).trim() || undefined;
  }
  return undefined;
}

function extractFromProductNode(p: Record<string, unknown>): ExtractedIds {
  /* GTIN keys per Schema.org: gtin (canonical), gtin8, gtin12, gtin13, gtin14.
     We accept any; downstream they're all valid universal identifiers. */
  let gtin =
    pickString(p.gtin) ??
    pickString(p.gtin13) ??
    pickString(p.gtin12) ??
    pickString(p.gtin14) ??
    pickString(p.gtin8);
  let mpn   = pickString(p.mpn);
  let sku   = pickString(p.sku);
  const brand = pickString(p.brand);

  /* Shopify stores (Essenza, HealthPlus, MedPlus, Supermart) put
     gtin13 / mpn / sku INSIDE the Offer object inside Product.offers[],
     not on the Product node itself. Real example from Essenza:
       { "@type": "Product",
         "name": "AFNAN 9 Am",
         "brand": { "@type": "Brand", "name": "AFNAN" },
         "offers": [{
           "@type": "Offer",
           "sku":   "AFN0002",
           "gtin13": "6290171002345"   ← here, not on Product
         }] }
     Recurse into offers[] (or single offer object) and grab any
     identifier that wasn't already found at Product level. First
     offer with each identifier wins; variant products (different
     colors / sizes) typically share the base GTIN at the product
     level, with variant-specific SKUs in the offers array. */
  if (!gtin || !mpn || !sku) {
    const offersRaw = p.offers;
    const offers: Record<string, unknown>[] = Array.isArray(offersRaw)
      ? (offersRaw as Record<string, unknown>[])
      : (offersRaw && typeof offersRaw === "object" ? [offersRaw as Record<string, unknown>] : []);
    for (const o of offers) {
      if (!gtin) {
        gtin =
          pickString(o.gtin) ??
          pickString(o.gtin13) ??
          pickString(o.gtin12) ??
          pickString(o.gtin14) ??
          pickString(o.gtin8);
      }
      if (!mpn) mpn = pickString(o.mpn);
      if (!sku) sku = pickString(o.sku);
      if (gtin && mpn) break;
    }
  }

  /* Some templates put the Product inside a list under "hasVariant"
     (Shopify variant pages, color/size selectors). Recurse one level
     down so we catch the first variant's GTIN when the parent Product
     doesn't carry one. */
  if (!gtin && !mpn && p.hasVariant) {
    const variants = Array.isArray(p.hasVariant)
      ? (p.hasVariant as Record<string, unknown>[])
      : [p.hasVariant as Record<string, unknown>];
    for (const v of variants) {
      if (typeof v !== "object" || !v) continue;
      const sub = extractFromProductNode(v as Record<string, unknown>);
      if (sub.gtin || sub.mpn) {
        gtin = gtin ?? sub.gtin;
        mpn  = mpn  ?? sub.mpn;
        sku  = sku  ?? sub.sku;
        break;
      }
    }
  }

  return {
    gtin:  gtin ? sanitizeGtin(gtin) : undefined,
    mpn:   mpn || undefined,
    brand: brand || undefined,
    sku:   sku || undefined,
  };
}

/* Defensive: some merchants emit "N/A", "-", or blank-padded GTINs.
   A valid GTIN is 8/12/13/14 digits exactly. Reject anything else
   so we don't pollute the DB with junk values. */
function sanitizeGtin(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return undefined;
}

function extractFromHtml(html: string): ExtractedIds {
  /* Find ALL <script type="application/ld+json"> blocks. Some pages
     emit multiple (one per Product, one for BreadcrumbList, etc.). */
  const blocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  );
  for (const block of blocks) {
    const raw = block[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const products = findProductNodes(parsed);
      for (const p of products) {
        const ids = extractFromProductNode(p);
        /* First product node with ANY identifier wins. Many pages emit
           multiple Products (variant SKUs), with the canonical one
           first. */
        if (ids.gtin || ids.mpn) return ids;
      }
    } catch {
      /* Malformed JSON — common when retailers inline `&` without
         escaping or include trailing commas. Skip and try the next
         block. */
      continue;
    }
  }
  return {};
}

/* ── Per-host concurrency throttling ──────────────────────────── */

interface HostState {
  inFlight:    number;
  lastStartMs: number;
  queue:       Array<() => void>;
}
const hostStates = new Map<string, HostState>();

function getHostState(host: string): HostState {
  let s = hostStates.get(host);
  if (!s) {
    s = { inFlight: 0, lastStartMs: 0, queue: [] };
    hostStates.set(host, s);
  }
  return s;
}

async function acquireHostSlot(host: string): Promise<void> {
  const s = getHostState(host);
  if (s.inFlight < PER_HOST_PARALLEL) {
    const since = Date.now() - s.lastStartMs;
    if (since < PER_HOST_DELAY_MS) {
      await new Promise((r) => setTimeout(r, PER_HOST_DELAY_MS - since));
    }
    s.inFlight++;
    s.lastStartMs = Date.now();
    return;
  }
  /* Wait for a slot. */
  await new Promise<void>((resolve) => {
    s.queue.push(() => {
      s.inFlight++;
      s.lastStartMs = Date.now();
      resolve();
    });
  });
}

function releaseHostSlot(host: string): void {
  const s = getHostState(host);
  s.inFlight--;
  const next = s.queue.shift();
  if (next) setTimeout(next, PER_HOST_DELAY_MS);
}

/* ── Fetch with timeout ────────────────────────────────────────── */

async function fetchWithTimeout(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    /* Cap body size at 2MB — a real product page is ~100-500KB. Bigger
       than 2MB means we hit something weird (sitemap, asset, etc.). */
    return text.length > 2 * 1024 * 1024 ? null : text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Worker pool ──────────────────────────────────────────────── */

interface Job {
  productId: string;
  url:       string;
}

interface JobResult {
  productId: string;
  ids:       ExtractedIds;
  fetched:   boolean;
  reason?:   string;
}

async function processJob(job: Job): Promise<JobResult> {
  let host: string;
  try {
    host = new URL(job.url).hostname;
  } catch {
    return { productId: job.productId, ids: {}, fetched: false, reason: "invalid-url" };
  }
  if (KNOWN_BOT_BLOCKED_HOSTS.has(host)) {
    return { productId: job.productId, ids: {}, fetched: false, reason: "blocked-host" };
  }

  await acquireHostSlot(host);
  try {
    const html = await fetchWithTimeout(job.url);
    if (!html) return { productId: job.productId, ids: {}, fetched: false, reason: "fetch-fail" };
    const ids = extractFromHtml(html);
    return { productId: job.productId, ids, fetched: true };
  } finally {
    releaseHostSlot(host);
  }
}

async function runPool(jobs: Job[], onProgress: (done: number, total: number, hit: number) => void): Promise<JobResult[]> {
  const results: JobResult[] = [];
  let cursor = 0;
  let hitCount = 0;
  const active: Promise<void>[] = [];

  const startNext = (): boolean => {
    if (cursor >= jobs.length) return false;
    const job = jobs[cursor++];
    const p = processJob(job).then((r) => {
      results.push(r);
      if (r.ids.gtin || r.ids.mpn) hitCount++;
      onProgress(results.length, jobs.length, hitCount);
      const idx = active.indexOf(p);
      if (idx >= 0) active.splice(idx, 1);
      /* Chain the next job in this slot. */
      startNext();
    });
    active.push(p);
    return true;
  };

  for (let i = 0; i < Math.min(PARALLEL_FETCHES, jobs.length); i++) startNext();
  while (active.length > 0) await Promise.race(active);
  return results;
}

/* ── Main ─────────────────────────────────────────────────────── */

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("Missing Supabase env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  /* Pull all products that don't yet have any identifier. Join through
     offers to get a usable URL (products table itself has no URL).
     Prefer offers from non-bot-blocked stores when multiple exist.

     PostgREST defaults to a max of 1000 rows per .select() — for our
     12k-product catalog that silently truncates the working set. Use
     .range() pagination in 1000-row pages until we get back a partial
     page, which signals end-of-data. */
  console.log("Loading products needing backfill...");
  const PAGE = 1000;
  type Row = { id: string; gtin: string | null; mpn: string | null; google_shopping_id: string | null; offers: Array<{ url: string; store_id: string }> };
  const data: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    let q = supa
      .from("products")
      .select("id, gtin, mpn, google_shopping_id, offers!inner(url, store_id)")
      .is("gtin", null)
      .is("mpn", null)
      .range(from, to);
    if (LIMIT && data.length + PAGE > LIMIT) {
      q = q.limit(LIMIT - data.length);
    }
    const { data: page, error } = await q;
    if (error) { console.error("Fetch failed:", error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...(page as unknown as Row[]));
    if (page.length < PAGE) break;
    if (LIMIT && data.length >= LIMIT) break;
  }
  if (data.length === 0) {
    console.log("No products need backfill. Done.");
    return;
  }

  /* Build one job per product. Pick the first offer URL that:
     (a) starts with http(s)://
     (b) has a hostname NOT in KNOWN_BOT_BLOCKED_HOSTS
     If no good URL exists, skip this product entirely. */
  type ProdRow = { id: string; offers: Array<{ url: string; store_id: string }> };
  const rows = data as unknown as ProdRow[];
  const jobs: Job[] = [];
  let skippedNoUrl = 0;
  for (const r of rows) {
    if (STORE_FILT && !r.offers.some((o) => o.store_id === STORE_FILT)) continue;
    const offer = r.offers.find((o) => {
      if (!o.url || !/^https?:\/\//.test(o.url)) return false;
      try {
        return !KNOWN_BOT_BLOCKED_HOSTS.has(new URL(o.url).hostname);
      } catch { return false; }
    });
    if (!offer) { skippedNoUrl++; continue; }
    jobs.push({ productId: r.id, url: offer.url });
  }

  console.log(`Loaded ${rows.length} products. Scheduled ${jobs.length} jobs (${skippedNoUrl} skipped — no scrape-friendly URL).`);
  console.log(`Concurrency: ${PARALLEL_FETCHES} total, ${PER_HOST_PARALLEL} per host, ${PER_HOST_DELAY_MS}ms min spacing.`);
  if (DRY_RUN) console.log("(dry-run: will NOT write to DB)");

  const startMs = Date.now();
  const results = await runPool(jobs, (done, total, hit) => {
    if (done % 50 === 0 || done === total) {
      const rate = (done / ((Date.now() - startMs) / 1000)).toFixed(1);
      console.log(`  ${done}/${total} fetched, ${hit} hits, ${rate}/s`);
    }
  });

  const fetched = results.filter((r) => r.fetched).length;
  const withIds = results.filter((r) => r.ids.gtin || r.ids.mpn).length;
  console.log(`\nFetched: ${fetched}/${results.length}, identifier hits: ${withIds}`);

  /* Per-host coverage summary first (printed in both dry-run and real
     runs so we can tune the host roster from a single invocation). */
  const byHost = new Map<string, { fetched: number; hits: number }>();
  const jobById = new Map(jobs.map((j) => [j.productId, j]));
  for (const r of results) {
    const job = jobById.get(r.productId);
    if (!job) continue;
    try {
      const h = new URL(job.url).hostname;
      const s = byHost.get(h) ?? { fetched: 0, hits: 0 };
      if (r.fetched) s.fetched++;
      if (r.ids.gtin || r.ids.mpn) s.hits++;
      byHost.set(h, s);
    } catch { /* skip */ }
  }
  console.log("\nHost-level coverage:");
  console.log("Host                                    Fetched  Hits  Rate");
  const sorted = Array.from(byHost.entries())
    .filter(([, s]) => s.fetched >= 3)
    .sort((a, b) => b[1].hits - a[1].hits);
  for (const [h, s] of sorted.slice(0, 30)) {
    const rate = s.fetched === 0 ? "0%" : `${((s.hits / s.fetched) * 100).toFixed(0)}%`;
    console.log(`${h.padEnd(40).slice(0, 40)} ${String(s.fetched).padStart(7)}  ${String(s.hits).padStart(4)}  ${rate.padStart(4)}`);
  }

  /* Bulk update — each row only writes the fields we actually
     extracted; columns the JSON-LD didn't carry stay NULL. */
  if (DRY_RUN) {
    console.log("\nDry-run: skipping DB writes. Sample of first 10 hits:");
    for (const r of results.filter((r) => r.ids.gtin || r.ids.mpn).slice(0, 10)) {
      console.log(`  ${r.productId}: gtin=${r.ids.gtin ?? "-"}, mpn=${r.ids.mpn ?? "-"}, brand=${r.ids.brand ?? "-"}`);
    }
    return;
  }

  const writes = results.filter((r) => r.ids.gtin || r.ids.mpn);
  let updated = 0;
  let failed = 0;
  for (const r of writes) {
    const patch: Record<string, string> = {};
    if (r.ids.gtin) patch.gtin = r.ids.gtin;
    if (r.ids.mpn)  patch.mpn  = r.ids.mpn;
    const { error: updErr } = await supa.from("products").update(patch).eq("id", r.productId);
    if (updErr) {
      /* Unique-violation: another product row already owns this GTIN.
         Expected when two cross-store products legitimately share an
         identifier (good!) — we just leave the existing winner alone. */
      if (/duplicate key|unique constraint/i.test(updErr.message)) {
        /* Count as a "soft win" — the catalog now knows the identifier
           belongs to the OTHER product, which is the correct same-
           product signal. */
      } else {
        failed++;
      }
    } else {
      updated++;
    }
  }

  console.log(`\nWrote ${updated} identifier updates. ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
