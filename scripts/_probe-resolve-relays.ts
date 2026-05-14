/* Probe: how well does resolveGoogleRelay handle the audit's 30
   relay=Y URLs?

   Runs the resolver against the same Google relay URLs the May 2026
   audit clicked through. For each, reports:
     • Final merchant URL (or "failed")
     • Strategy that succeeded (dom-extraction / click-through / failed)
     • Whether the merchant host matches the expected store
     • Elapsed time

   This is the Path B validation step — proves the resolver works
   before we wire it into the ingest pipeline or run a backfill. */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

// @ts-ignore — playwright-extra has no bundled TS types
import { chromium } from "playwright-extra";
// @ts-ignore
import StealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(StealthPlugin());

import { resolveGoogleRelay } from "./scrapers/resolve-google-relay.js";
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const AUDIT_OFFER_IDS = [
  // UK
  "694c60bc-167a-4ff2-9adb-79294b34e865", // argos
  "5c12e6a1-cd28-4e17-9b4d-c0460883cb93", // boots
  "ef501579-aaed-4a75-9e35-fd3c7a75f723", // currys
  "c72aad2b-b004-4836-93a7-64a378a04345", // halfords
  "35d7937e-f8e6-4fa0-a9fb-137fa01fdcb5", // john-lewis
  // US
  "35a0d834-ea98-4bd0-9729-e3e121a35deb", // best-buy
  "1dfebbc3-9a71-4897-ab30-1d3602472cfb", // fashion-nova
  "b5f3231a-2e71-4d6d-a441-454bc55738bb", // kohl's
  // DE
  "6fe3d005-ee9a-4519-941d-cd4da3a7ea54", // amazon-de
  // AE
  "c1d9fb4c-2de8-4abe-8f5f-21c70410bcf9", // amazon-ae-retail
  // IN
  "5f69ecd6-d38f-453f-ace6-fe058c4c1f70", // ajio
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

interface OfferRow {
  id:       string;
  url:      string;
  store_id: string;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no supabase"); process.exit(1); }

  const { data, error } = await supa
    .from("offers")
    .select("id, url, store_id")
    .in("id", AUDIT_OFFER_IDS);
  if (error) { console.error("✗ query:", error.message); process.exit(1); }
  const rows = (data ?? []) as OfferRow[];
  console.log(`\nResolving ${rows.length} relay URLs from the audit...\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    locale:    "en-US",
    /* Pre-set Google's consent cookies on every Google domain so
       the bot doesn't get redirected to consent.google.com/ before
       the shopping page renders. SOCS is Google's "consent
       choices" cookie; YES+ on CONSENT is the universal "user
       accepted everything" marker that bypasses the modal. */
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  /* Cookie set via context.addCookies (rather than the new-context
     cookies init) so we can target every Google TLD at once.
     SOCS value lifted from a real consent-accepted Chrome session;
     YES+ is the legacy CONSENT cookie format. */
  await context.addCookies([
    { name: "SOCS",    value: "CAESHAgBEhJnd3NfMjAyNDA4MDMtMF9SQzMaAmVuIAEaBgiAxqW2Bg", domain: ".google.com",    path: "/", expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 },
    { name: "CONSENT", value: "YES+",  domain: ".google.com",   path: "/", expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 },
    { name: "CONSENT", value: "YES+",  domain: ".google.co.uk", path: "/", expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 },
    { name: "CONSENT", value: "YES+",  domain: ".google.de",    path: "/", expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 },
  ]);
  const page = await context.newPage();

  type Outcome = { offerId: string; storeId: string; result: Awaited<ReturnType<typeof resolveGoogleRelay>>; expectedHost: string };
  const outcomes: Outcome[] = [];

  for (const row of rows) {
    const expectedHost = expectedHostForStoreId(row.store_id);
    process.stdout.write(`  ${row.store_id.padEnd(28)} ... `);
    /* Unwrap /api/go?url=... if the offer URL is the relative wrap
       form (ingest stores both wrapped and bare relays). The
       resolver wants the actual Google relay URL, not the wrap. */
    let relayUrl = row.url;
    if (relayUrl.startsWith("/api/go?")) {
      const wrapped = new URL(relayUrl, "https://havlo.io");
      relayUrl = wrapped.searchParams.get("url") ?? relayUrl;
    }
    const result = await resolveGoogleRelay(page, relayUrl, expectedHost);
    outcomes.push({ offerId: row.id, storeId: row.store_id, result, expectedHost });

    if (result.url) {
      let host = "?"; try { host = new URL(result.url).hostname; } catch {}
      const match = host.replace(/^www\./, "") === expectedHost
        || host.endsWith("." + expectedHost)
        || expectedHost.endsWith("." + host);
      console.log(`${match ? "✓" : "≈"} ${result.strategy.padEnd(16)} ${result.elapsedMs}ms  →  ${host}`);
    } else {
      console.log(`✗ ${result.strategy.padEnd(16)} ${result.elapsedMs}ms  (status=${result.httpStatus ?? "?"})`);
    }
  }

  await browser.close();

  /* ── Summary ─────────────────────────────────────────────────── */
  console.log("\n=== Summary ===\n");
  const successful = outcomes.filter((o) => o.result.url !== null);
  const onExpectedMerchant = successful.filter((o) => {
    if (!o.result.url) return false;
    try {
      const host = new URL(o.result.url).hostname.replace(/^www\./, "");
      return host === o.expectedHost
          || host.endsWith("." + o.expectedHost)
          || o.expectedHost.endsWith("." + host);
    } catch { return false; }
  });
  console.log(`  Resolved at all:           ${successful.length} / ${outcomes.length}`);
  console.log(`  On expected merchant host: ${onExpectedMerchant.length} / ${outcomes.length}`);

  /* Strategy distribution. */
  const byStrategy: Record<string, number> = { "dom-extraction": 0, "click-through": 0, "failed": 0 };
  for (const o of outcomes) byStrategy[o.result.strategy] = (byStrategy[o.result.strategy] ?? 0) + 1;
  console.log("\n  Strategy:");
  for (const [k, v] of Object.entries(byStrategy)) console.log(`    ${k.padEnd(16)} ${v}`);

  /* Failures detail. */
  const failed = outcomes.filter((o) => o.result.url === null);
  if (failed.length > 0) {
    console.log("\n  Failures (need a fallback):");
    for (const f of failed) console.log(`    ${f.storeId.padEnd(28)} HTTP=${f.result.httpStatus ?? "?"}`);
  }
}

function expectedHostForStoreId(storeId: string): string {
  const map: Record<string, string> = {
    "argos":               "argos.co.uk",
    "boots":               "boots.com",
    "currys":              "currys.co.uk",
    "halfords":            "halfords.com",
    "john-lewis-partners": "johnlewis.com",
    "best-buy":            "bestbuy.com",
    "fashion-nova":        "fashionnova.com",
    "kohl-s":              "kohls.com",
    "amazon-de":           "amazon.de",
    "amazon-ae-retail":    "amazon.ae",
    "ajio":                "ajio.com",
  };
  return map[storeId] ?? "(unknown)";
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
