/* Google Shopping relay → merchant URL backfill / ongoing resolver.

   What this is
   ────────────
   Iterates `offers` rows whose URL is a Google Shopping relay (the
   click-through page Google shows before sending the user to the
   actual merchant), opens each in Playwright, captures the
   merchant URL after Google's interstitial renders, and writes the
   merchant URL back to `offers.url`.

   Single script serves two purposes:
     1. ONE-TIME BACKFILL of the existing catalogue (~3,993 rows
        when this script was written). Run once, drain over a few
        invocations.
     2. ONGOING RESOLVER for rows newly ingested by the SerpAPI
        Google Shopping ingest. Scheduled via GitHub Actions to
        run every few hours and pick up any new relay URLs.

   The script is IDEMPOTENT — re-running picks up only rows whose
   URL still matches the relay pattern. Once a row is resolved to a
   merchant URL, it no longer matches the SELECT filter and won't
   be touched again.

   Why decoupled (not inline in ingest)
   ─────────────────────────────────────
   Per-row resolution takes ~1.5s of Playwright wall time. The
   SerpAPI Google Shopping ingest pulls 100+ rows per query × 20+
   queries per run = 2,000+ relays per ingest cycle. Adding inline
   resolution would push ingest from ~10 min to ~50 min — well
   past the 25-min GitHub Actions timeout we just fixed in
   04085b6.

   Decoupled architecture keeps ingest fast (writes relay URLs
   directly, same as before) and runs resolution on its own
   relaxed cadence. /api/go's merchant_search fallback ALREADY
   gracefully handles unresolved relay rows at click time, so the
   delay between ingest and resolution is invisible to users.

   Safety
   ──────
   • Updates `offers.url` in-place. To revert: re-ingest, or
     reverse from click_resolutions telemetry which logs every
     redirect chain.
   • Pace: ~1.5s per resolve (Playwright wall time) + a small
     jitter so Google's anti-bot doesn't notice a metronome.
   • Concurrency: defaults to 2 parallel browsers (set via
     --concurrency env). Higher = faster but more anti-bot risk.
   • Per-run cap: --limit N (default 500). Lets a scheduled run
     stay inside a sensible Actions runtime envelope while still
     making progress on the backlog.
   • Stale resolution detection: if the resolved URL is itself
     another Google domain or matches a "noise" list (reddit,
     youtube, etc.), the row is left as-is rather than corrupting
     it. */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

// @ts-ignore — playwright-extra has no bundled TS types
import { chromium } from "playwright-extra";
// @ts-ignore
import StealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(StealthPlugin());

import type { Browser, BrowserContext, Page } from "playwright";
import { resolveGoogleRelay } from "./scrapers/resolve-google-relay.js";
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/* CLI flags
   ──────────────────────────────────────────────────────────────────
   --limit N         max rows to process this invocation (default 500)
   --concurrency N   parallel browsers (default 2)
   --dry-run         resolve + log, but DON'T write back to offers
   --verbose         print every URL pair, not just failures */
function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
const LIMIT       = parseInt(arg("--limit",       "500"), 10);
const CONCURRENCY = parseInt(arg("--concurrency", "2"),   10);
const DRY_RUN     = process.argv.includes("--dry-run");
const VERBOSE     = process.argv.includes("--verbose");

interface OfferRow {
  id:       string;
  url:      string;
  store_id: string;
}

interface StoreRow {
  id:   string;
  name: string;
}

/* Map storeId → expected merchant hostname. Used by the resolver
   to pick the right outbound href when Google's DOM contains
   multiple non-Google links (reviews / discussions / merchant). */
function buildExpectedHostMap(stores: StoreRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of stores) {
    /* Lift a hostname guess from the store name / id. For now, use
       the same heuristic the runtime fallback uses (smartFallbackUrl)
       so we stay consistent. If the runtime can guess "argos.co.uk"
       from storeId=argos via the curated MERCHANTS table, we
       should too. */
    const guess = guessHostnameFromStoreId(s.id);
    if (guess) map.set(s.id, guess);
  }
  return map;
}

/* Lightweight hostname guess by storeId convention. Mirrors the
   "ingest tagged with country names" patterns we know about. The
   real source of truth is merchant-search-urls.ts, but importing
   that module pulls in the whole tree — and we only need the
   hostname half. Keep this list in lockstep when patterns change. */
function guessHostnameFromStoreId(storeId: string): string | null {
  const sid = storeId.toLowerCase();
  /* Amazon marketplaces — match the affiliate.ts TLD set. */
  if (sid.includes("amazon")) {
    if (sid.includes("uk") || sid.includes("co-uk"))     return "amazon.co.uk";
    if (sid.includes("de")  || sid.includes("germany"))  return "amazon.de";
    if (sid.includes("ae")  || sid.includes("uae"))      return "amazon.ae";
    if (sid.includes("in")  || sid.includes("india"))    return "amazon.in";
    if (sid.includes("fr")  || sid.includes("france"))   return "amazon.fr";
    if (sid.includes("ca")  || sid.includes("canada"))   return "amazon.ca";
    if (sid.includes("co-za")|| sid.includes("south-africa")) return "amazon.co.za";
    return "amazon.com";
  }
  /* Curated long-tail merchants. Same patterns as
     src/lib/merchant-search-urls.ts — kept here mostly so the
     resolver can prioritise the right merchant. Falls back to
     storeId.com guessing for anything not in the map. */
  const explicit: Record<string, string> = {
    "argos":               "argos.co.uk",
    "boots":               "boots.com",
    "currys":              "currys.co.uk",
    "halfords":            "halfords.com",
    "john-lewis-partners": "johnlewis.com",
    "matalan":             "matalan.co.uk",
    "selfridges":          "selfridges.com",
    "marks-electrical":    "markselectrical.co.uk",
    "next":                "next.co.uk",
    "asos":                "asos.com",
    "very":                "very.co.uk",
    "jd-sports":           "jdsports.co.uk",
    "best-buy":            "bestbuy.com",
    "kohl-s":              "kohls.com",
    "macy-s":              "macys.com",
    "walmart":             "walmart.com",
    "fashion-nova":        "fashionnova.com",
    "dick-s-sporting-goods": "dickssportinggoods.com",
    "ajio":                "ajio.com",
    "flipkart":            "flipkart.com",
    "myntra":              "myntra.com",
    "nykaa":               "nykaa.com",
    "tatacliq":            "tatacliq.com",
    "mediamarkt":          "mediamarkt.de",
    "saturn":              "saturn.de",
    "otto":                "otto.de",
    "zalando":             "zalando.de",
    "noon":                "noon.com",
    "sharafdg":            "uae.sharafdg.com",
    "takealot":            "takealot.com",
    "makro":               "makro.co.za",
    "shein":               "shein.com",
    "aliexpress":          "aliexpress.com",
    "temu":                "temu.com",
    "dhgate":              "dhgate.com",
    "cotton-on":           "cottonon.com",
  };
  if (explicit[sid]) return explicit[sid];
  /* Last-ditch: assume storeId → "<slug>.com" (best-effort). The
     resolver still works without this — it just falls back to "any
     non-Google non-noise href" instead of the merchant-targeted
     priority lane. */
  return null;
}

/* Unwrap /api/go?url=https%3A%2F%2Fwww.google.com%2F... so we
   resolve the inner relay, not the Havlo redirect wrapper. */
function unwrapApiGo(rawUrl: string): string {
  if (!rawUrl.startsWith("/api/go?")) return rawUrl;
  try {
    const wrapped = new URL(rawUrl, "https://havlo.io");
    return wrapped.searchParams.get("url") ?? rawUrl;
  } catch {
    return rawUrl;
  }
}

/* Final-URL safety: don't write a Google or noise host back. If
   the resolver returns one of these (rare — usually means the
   priority cascade fell through to "any href"), skip the row. */
function isSafeMerchantUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === "google.com" || h.endsWith(".google.com")) return false;
    if (h === "youtube.com" || h.endsWith(".youtube.com")) return false;
    if (h === "reddit.com" || h.endsWith(".reddit.com")) return false;
    if (h === "wikipedia.org" || h.endsWith(".wikipedia.org")) return false;
    if (h === "support.google.com") return false;
    return true;
  } catch {
    return false;
  }
}

/* Per-worker resolution loop. Each worker owns one browser
   context so they don't race on cookies / page state. */
async function workerLoop(
  workerId: number,
  rows: OfferRow[],
  expectedHostMap: Map<string, string>,
  context: BrowserContext,
  stats: { resolved: number; failed: number; skipped: number; sampleFailures: string[] },
) {
  const supa = getSupabaseAdmin();
  if (!supa) throw new Error("no supabase");
  const page = await context.newPage();

  /* Adaptive pacing — start at 1.5s between resolves, ramp up on
     consecutive 429s (Google's "too many requests" signal), ramp
     back down when the streak breaks. Without this, sustained
     runs eventually hit Google's rate limit and the streak of
     429s wastes minutes producing zero useful results. */
  let consecutive429s = 0;
  const BASE_PACE_MS = 1_500;
  /* Capped at 8s (was 15s). First production run drained only ~51
     rows in 50 minutes because backoff at 15s + Playwright ~5s nav
     = ~20s per row once Google started rate-limiting. 8s gives
     enough recovery time without strangling throughput when the
     ramp settles. */
  const MAX_PACE_MS  = 8_000;

  for (const row of rows) {
    const relayUrl    = unwrapApiGo(row.url);
    const expectedHost = expectedHostMap.get(row.store_id);
    /* Pace = base × 2^consecutive429s, capped. Each 429 doubles
       the wait; one clean resolve halves it. Adds 0-400ms jitter
       so we don't metronome. */
    /* Cap the doubling at 3 — beyond that the pace is already at
       MAX_PACE_MS and adding to the counter just delays recovery. */
    const exponent = Math.min(consecutive429s, 3);
    const paceMs   = Math.min(BASE_PACE_MS * Math.pow(2, exponent), MAX_PACE_MS);
    const jitter   = Math.floor(Math.random() * 400);
    await new Promise((r) => setTimeout(r, paceMs + jitter));

    const result = await resolveGoogleRelay(page, relayUrl, expectedHost);

    /* 429 ramp tracking. Google returns 429 on the navigation
       itself, surfaced via result.httpStatus. */
    if (result.httpStatus === 429) {
      consecutive429s = Math.min(consecutive429s + 1, 6);
    } else if (result.url) {
      consecutive429s = Math.max(consecutive429s - 1, 0);
    }

    if (!result.url) {
      stats.failed++;
      if (stats.sampleFailures.length < 10) {
        stats.sampleFailures.push(`${row.store_id} [worker ${workerId}] HTTP=${result.httpStatus ?? "?"}`);
      }
      if (VERBOSE) console.log(`  [w${workerId}] ✗ ${row.id.slice(0, 8)} ${row.store_id.padEnd(28)} HTTP=${result.httpStatus ?? "?"}`);
      continue;
    }

    if (!isSafeMerchantUrl(result.url)) {
      stats.skipped++;
      if (VERBOSE) console.log(`  [w${workerId}] ⌽ ${row.id.slice(0, 8)} ${row.store_id.padEnd(28)} unsafe host: ${new URL(result.url).hostname}`);
      continue;
    }

    if (DRY_RUN) {
      stats.resolved++;
      if (VERBOSE) console.log(`  [w${workerId}] ⇢ ${row.id.slice(0, 8)} ${row.store_id.padEnd(28)} → ${result.url.slice(0, 80)}`);
      continue;
    }

    /* Write the resolved merchant URL back. Single-row UPDATE so
       a transient DB error on one row doesn't stall the others. */
    const { error } = await supa
      .from("offers")
      .update({ url: result.url })
      .eq("id", row.id);
    if (error) {
      stats.failed++;
      if (stats.sampleFailures.length < 10) {
        stats.sampleFailures.push(`${row.store_id} [DB error] ${error.message.slice(0, 60)}`);
      }
      continue;
    }

    stats.resolved++;
    if (VERBOSE || stats.resolved % 25 === 0) {
      console.log(`  [w${workerId}] ✓ ${row.id.slice(0, 8)} ${row.store_id.padEnd(28)} → ${result.url.slice(0, 80)}`);
    }
  }

  await page.close();
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no supabase"); process.exit(1); }

  console.log(`\nGoogle relay resolver`);
  console.log(`  --limit       ${LIMIT}`);
  console.log(`  --concurrency ${CONCURRENCY}`);
  console.log(`  --dry-run     ${DRY_RUN}`);
  console.log(`  --verbose     ${VERBOSE}\n`);

  /* Pull the unresolved rows. Both shapes of relay URL covered:
       direct Google host, /api/go?url= wrap. ORDER BY created_at
       ASC processes oldest rows first — newest rows are more
       likely to still match the catalogue (less likely to be
       stale by the time the user clicks), so we'd rather get the
       backlog drained before touching the head. */
  const { data, error } = await supa
    .from("offers")
    .select("id, url, store_id")
    .or("url.ilike.%google.com/search%,url.ilike.%google.com%2Fsearch%")
    /* Order by scraped_at ASC — oldest first. Older rows are most
       likely to have stale product URLs anyway; getting them
       resolved and replacing them with merchant URLs gives the
       backfill the highest leverage per row. */
    .order("scraped_at", { ascending: true, nullsFirst: false })
    .limit(LIMIT);
  if (error) { console.error("✗ query:", error.message); process.exit(1); }
  const rows = (data ?? []) as OfferRow[];
  console.log(`Found ${rows.length} relay URLs to resolve.`);
  if (rows.length === 0) {
    console.log("\nNothing to do — backlog cleared.");
    return;
  }

  /* Build the expected-host map once up front by pulling distinct
     storeIds we'll see in this batch. */
  const distinctStoreIds = [...new Set(rows.map((r) => r.store_id))];
  const { data: storeRows } = await supa
    .from("stores")
    .select("id, name")
    .in("id", distinctStoreIds);
  const stores = (storeRows ?? []) as StoreRow[];
  const expectedHostMap = buildExpectedHostMap(stores);

  console.log(`Stores in batch: ${stores.length} (with hostname hints: ${expectedHostMap.size})\n`);

  /* Split rows across workers — round-robin so each worker gets a
     mix of stores rather than all-one-merchant in one bucket. */
  const buckets: OfferRow[][] = Array.from({ length: CONCURRENCY }, () => []);
  for (let i = 0; i < rows.length; i++) buckets[i % CONCURRENCY].push(rows[i]);

  const browser: Browser = await chromium.launch({ headless: true });

  /* One browser context per worker so each carries its own
     cookies (Google's consent cookie set below is per-context). */
  const contexts: BrowserContext[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const ctx = await browser.newContext({
      userAgent:        UA,
      locale:           "en-US",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    });
    /* Skip Google's consent gate. Without these cookies, every
       relay redirects to consent.google.com and we never see the
       shopping page. Values are anonymous "accepted all" markers,
       safe to share across contexts. */
    const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 365;
    await ctx.addCookies([
      { name: "SOCS",    value: "CAESHAgBEhJnd3NfMjAyNDA4MDMtMF9SQzMaAmVuIAEaBgiAxqW2Bg", domain: ".google.com",    path: "/", expires: expiresAt },
      { name: "CONSENT", value: "YES+",  domain: ".google.com",    path: "/", expires: expiresAt },
      { name: "CONSENT", value: "YES+",  domain: ".google.co.uk",  path: "/", expires: expiresAt },
      { name: "CONSENT", value: "YES+",  domain: ".google.de",     path: "/", expires: expiresAt },
    ]);
    contexts.push(ctx);
  }

  const stats = { resolved: 0, failed: 0, skipped: 0, sampleFailures: [] as string[] };
  const t0 = Date.now();

  /* Fire all workers in parallel. Each chews through its bucket
     at the jittered pace. */
  await Promise.all(buckets.map((b, i) => workerLoop(i, b, expectedHostMap, contexts[i], stats)));

  /* Close everything. */
  for (const ctx of contexts) await ctx.close();
  await browser.close();

  const elapsedMin = ((Date.now() - t0) / 60_000).toFixed(1);
  console.log(`\n──────────────────────────────────────`);
  console.log(`Done in ${elapsedMin} min.`);
  console.log(`  resolved: ${stats.resolved}`);
  console.log(`  failed:   ${stats.failed}`);
  console.log(`  skipped:  ${stats.skipped} (unsafe / noise host)`);
  if (stats.sampleFailures.length > 0) {
    console.log(`\nSample failures:`);
    for (const s of stats.sampleFailures) console.log(`  ${s}`);
  }
  console.log(`\nRemaining relay rows can be processed by a follow-up run.`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
