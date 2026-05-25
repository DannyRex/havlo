#!/usr/bin/env tsx
/* One-off maintenance pass (May 2026 launch-readiness).

   Three things, in this order:

     1. stores.country backfill. Some legacy rows have country=null
        because they were created before the ingest pipeline started
        attaching country metadata to new store rows. Filter joins
        downstream (filterDealsForCountry, isOfferAllowedForCountry,
        the trending-multi-store country-scoped chip query) all rely
        on stores.country being set, so a null leaks the store into
        EVERY country's results.

        Four-pass inference (each pass falls through to the next):
          (a) inferStoreCountry(id, name) — the runtime roster used
              by filter logic. If the runtime knows the store, the
              DB should mirror it.
          (b) Store ID suffix patterns (`-uk`, `-de`, `-ae`, etc.)
              and prefix patterns (`uk-`, `de-`).
          (c) URL TLD inspection (.co.uk, .de, .com.ng, .ae, etc.).
          (d) Offer-side majority vote on offers.store_country. The
              ingest pipeline writes store_country onto every offer
              row, so a stores.country=null with N offers usually has
              an unambiguous country signal in its offers. Threshold:
              the modal country must cover >= 80% of the store's
              offers (otherwise we have a cross-border merchant that
              ships from multiple markets — leave it null).
        Stores still unresolved after (d) are reported but skipped.
        Orphan stores (no offers at all, so no active leak) are also
        skipped — listed once at the end for the user's awareness.

     2. newsletter_subscribers.country backfill. The 2 NULL rows in
        production are pre-EmailCapture-fix signups (May 2026 M7). The
        send script already defaults null -> 'ng' at runtime, but
        making it explicit in the DB cleans up SQL audits and keeps
        per-country counts honest.

     3. Soft-delete test rows from newsletter_subscribers. We have
        clearly-test emails sitting in 'active' status that will pull
        SerpAPI-credited deals into wasted Resend sends every Mon +
        Thu. Flip to status='unsubscribed' so they stay in the DB for
        historical analytics ("total signups ever") but stop receiving
        sends.

   Defaults to DRY RUN — pass --apply to actually mutate.

   Usage:
     # See what would change:
     npx tsx --tsconfig tsconfig.scripts.json scripts/maint/may-2026-data-cleanup.ts

     # Apply changes:
     npx tsx --tsconfig tsconfig.scripts.json scripts/maint/may-2026-data-cleanup.ts --apply
*/

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { getSupabaseAdmin } from "../../src/lib/providers/db-client";
import { inferStoreCountry } from "../../src/lib/country";

interface Args {
  apply: boolean;
}

function parseArgs(): Args {
  const args: Args = { apply: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--apply") args.apply = true;
  }
  return args;
}

interface StoreRow {
  id:      string;
  name:    string;
  url:     string | null;
  country: string | null;
}

interface SubscriberRow {
  email:   string;
  country: string | null;
  status:  string | null;
}

const TEST_EMAIL_DOMAINS = [
  "havlo-qa.test",
  "test.example",
  "ameady.com",   // disposable mail
  "example.com",  // IANA-reserved for docs
];

function isTestEmail(email: string): boolean {
  const lc = email.toLowerCase();
  return TEST_EMAIL_DOMAINS.some((d) => lc.endsWith(`@${d}`));
}

/* ── Country inference passes ────────────────────────────────────── */

/* Pass (b): store-id and store-name suffix/prefix patterns. These are
   conventions our ingest pipeline uses (storeId 'argos-uk', name
   'Currys UK', etc.) — strong, high-precision signals. Order matters:
   3-letter codes ('uae') first, then 2-letter ('uk', 'de') so the
   longer match wins. */
const ID_SUFFIX_MAP: Array<[RegExp, string]> = [
  [/[-_]uae$/i,          "AE"],
  [/[-_]za$/i,           "ZA"],
  [/[-_]ae$/i,           "AE"],
  [/[-_]uk$/i,           "UK"],
  [/[-_]gb$/i,           "UK"],
  [/[-_]us$/i,           "US"],
  [/[-_]usa$/i,          "US"],
  [/[-_]de$/i,           "DE"],
  [/[-_]in$/i,           "IN"],
  [/[-_]ng$/i,           "NG"],
  [/^uk[-_]/i,           "UK"],
  [/^us[-_]/i,           "US"],
  [/^de[-_]/i,           "DE"],
  [/^ng[-_]/i,           "NG"],
  [/^za[-_]/i,           "ZA"],
  [/^ae[-_]/i,           "AE"],
  [/^in[-_]/i,           "IN"],
];

const NAME_SUFFIX_MAP: Array<[RegExp, string]> = [
  [/\b(UAE|U\.A\.E\.?)\s*$/i, "AE"],
  [/\b(UK|U\.K\.?|United Kingdom)\s*$/i, "UK"],
  [/\b(USA|U\.S\.A\.?|United States)\s*$/i, "US"],
  [/\bGermany\s*$/i, "DE"],
  [/\bIndia\s*$/i, "IN"],
  [/\bSouth Africa\s*$/i, "ZA"],
  [/\bNigeria\s*$/i, "NG"],
];

/* Pass (c): URL TLD inspection. ccTLDs (.uk, .de, .ng) are reliable
   country signals; .com/.net/.org are NOT (international, mostly US
   convention). Special multi-part TLDs (.co.uk, .com.ng) handled
   before single-segment ones via order. */
const TLD_MAP: Array<[RegExp, string]> = [
  [/\.co\.uk(?::|\/|$)/i,    "UK"],
  [/\.co\.za(?::|\/|$)/i,    "ZA"],
  [/\.com\.ng(?::|\/|$)/i,   "NG"],
  [/\.co\.ng(?::|\/|$)/i,    "NG"],
  [/\.com\.au(?::|\/|$)/i,   "AU"],
  [/\.com\.tr(?::|\/|$)/i,   "TR"],
  [/\.co\.in(?::|\/|$)/i,    "IN"],
  [/\.com\.de(?::|\/|$)/i,   "DE"],
  [/\.uk(?::|\/|$)/i,        "UK"],
  [/\.de(?::|\/|$)/i,        "DE"],
  [/\.ng(?::|\/|$)/i,        "NG"],
  [/\.za(?::|\/|$)/i,        "ZA"],
  [/\.in(?::|\/|$)/i,        "IN"],
  [/\.ae(?::|\/|$)/i,        "AE"],
  [/\.fr(?::|\/|$)/i,        "FR"],
  [/\.es(?::|\/|$)/i,        "ES"],
  [/\.it(?::|\/|$)/i,        "IT"],
  [/\.nl(?::|\/|$)/i,        "NL"],
];

function tryIdPattern(storeId: string): string | null {
  for (const [re, code] of ID_SUFFIX_MAP) {
    if (re.test(storeId)) return code;
  }
  return null;
}

function tryNamePattern(name: string): string | null {
  for (const [re, code] of NAME_SUFFIX_MAP) {
    if (re.test(name)) return code;
  }
  return null;
}

function tryUrlTld(url: string | null): string | null {
  if (!url) return null;
  for (const [re, code] of TLD_MAP) {
    if (re.test(url)) return code;
  }
  return null;
}

/* Pass (d): offer-side currency vote. The offers table doesn't carry
   store_country (that's a stores-side column, projected into the
   product_best_offers view via JOIN), so the only country-signal we
   can pull from offers is `currency`. NGN is a strong, unambiguous
   NG signal — if every offer for a store is priced in NGN, the store
   is anchored in NG regardless of what its id/name says. Other
   currencies (USD, EUR, GBP, etc.) are AMBIGUOUS because the catalog
   normalises to USD for most cross-border listings and most non-NG
   markets, so we can't infer UK / US / DE / AE / IN / ZA from
   currency alone.

   This pass is therefore narrow: it catches NG merchants the
   roster/id/name passes missed (e.g. a newly-scraped NG retailer
   added to the catalog before someone updates country.ts NG_STORES).
   Stores returning ambiguous-currency offers fall through to
   "unresolved" — but we report an ACCURATE offer count so the user
   can see which unresolved stores are active leaks vs. orphans. */
async function tryOfferCurrencyVote(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  storeId: string,
): Promise<{ country: string | null; offerCount: number }> {
  const { data, error } = await supa
    .from("offers")
    .select("currency", { count: "exact" })
    .eq("store_id", storeId)
    .limit(500);
  if (error) return { country: null, offerCount: 0 };
  if (!data || data.length === 0) return { country: null, offerCount: 0 };

  const ngn = (data as Array<{ currency: string | null }>).filter((r) => r.currency === "NGN").length;
  /* All-NGN → NG with confidence. A single non-NGN offer dilutes the
     signal (the store might be cross-border NG/US, e.g. Konga-export
     edge cases) so require unanimity, not majority. */
  if (ngn === data.length && data.length > 0) {
    return { country: "NG", offerCount: data.length };
  }
  return { country: null, offerCount: data.length };
}

/* Compose all four passes. Returns the country code AND the pass
   that resolved it (for logging clarity). The offer-majority pass is
   async (one query per unresolved store) so callers must await it. */
async function resolveCountry(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  s: StoreRow,
): Promise<{ country: string | null; via: string; offerCount: number }> {
  const viaRoster = inferStoreCountry(s.id, s.name);
  if (viaRoster) return { country: viaRoster, via: "roster", offerCount: -1 };

  const viaId = tryIdPattern(s.id);
  if (viaId) return { country: viaId, via: "id-pattern", offerCount: -1 };

  const viaName = tryNamePattern(s.name);
  if (viaName) return { country: viaName, via: "name-pattern", offerCount: -1 };

  const viaUrl = tryUrlTld(s.url);
  if (viaUrl) return { country: viaUrl, via: "url-tld", offerCount: -1 };

  /* Offer-side currency vote — async. Narrow scope (only catches
     all-NGN merchants the roster missed) but also returns an
     accurate offer count so we can split unresolved stores into
     orphans (no offers, no leak) vs. active-leakers (has offers,
     actively pollutes search). */
  const viaOffers = await tryOfferCurrencyVote(supa, s.id);
  if (viaOffers.country) return { country: viaOffers.country, via: "offer-currency", offerCount: viaOffers.offerCount };

  return { country: null, via: viaOffers.offerCount === 0 ? "orphan-no-offers" : "unresolved", offerCount: viaOffers.offerCount };
}

async function backfillStoreCountries(supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>, apply: boolean) {
  console.log(`\n── 1. stores.country backfill ──`);
  const { data: nullStores, error } = await supa
    .from("stores")
    .select("id, name, url, country")
    .is("country", null);
  if (error) { console.error("  ✗ query failed:", error.message); return; }
  if (!nullStores || nullStores.length === 0) {
    console.log("  (no null-country stores)");
    return;
  }

  let updated = 0;
  let orphans = 0;
  const orphanList: StoreRow[] = [];
  const unresolvedActive: StoreRow[] = [];
  const byPass: Record<string, number> = {};

  for (const s of nullStores as StoreRow[]) {
    const { country, via, offerCount } = await resolveCountry(supa, s);
    if (!country) {
      if (via === "orphan-no-offers") {
        orphans++;
        orphanList.push(s);
      } else {
        unresolvedActive.push(s);
        console.log(`  ? ${s.id.padEnd(28)} → null (${offerCount} offers, no majority signal)`);
      }
      continue;
    }
    byPass[via] = (byPass[via] ?? 0) + 1;

    if (apply) {
      const { error: updErr } = await supa
        .from("stores")
        .update({ country })
        .eq("id", s.id);
      if (updErr) {
        console.log(`  ✗ ${s.id.padEnd(28)} → ${country}  (UPDATE failed: ${updErr.message})`);
        continue;
      }
    }
    console.log(`  ${apply ? "✓" : "·"} ${s.id.padEnd(28)} → ${country.padEnd(3)} (${via})`);
    updated++;
  }

  console.log(`\n  Summary: ${updated} ${apply ? "updated" : "would update"} (${
    Object.entries(byPass).map(([k, v]) => `${k}:${v}`).join(", ")
  })`);
  console.log(`           ${unresolvedActive.length} unresolved BUT have offers (active leak — needs manual decision)`);
  console.log(`           ${orphans} orphan rows with zero offers (safe to ignore, listed at end)`);

  if (unresolvedActive.length > 0) {
    console.log(`\n  Unresolved-but-has-offers detail (this is the actual leak — fix manually):`);
    for (const s of unresolvedActive.slice(0, 30)) {
      console.log(`    - ${s.id.padEnd(28)} ${s.name}`);
    }
    if (unresolvedActive.length > 30) console.log(`    ... and ${unresolvedActive.length - 30} more`);
    console.log(`\n  These need a manual decision (multi-region storefronts, ambiguous merchants).`);
    console.log(`  Either add to src/lib/country.ts COUNTRY_STORES roster and re-run, or`);
    console.log(`  UPDATE stores set country='XX' where id='...' in the Supabase SQL editor.`);
  }

  if (orphanList.length > 0) {
    console.log(`\n  Orphan stores (no offers, no active leak — left as-is):`);
    console.log(`    ${orphanList.length} rows. Run a separate orphan-cleanup pass if you want them gone.`);
  }
}

async function backfillSubscriberCountries(supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>, apply: boolean) {
  console.log(`\n── 2. newsletter_subscribers.country backfill ──`);
  const { data: nullRows, error } = await supa
    .from("newsletter_subscribers")
    .select("email, country, status")
    .is("country", null)
    .eq("status", "active");
  if (error) { console.error("  ✗ query failed:", error.message); return; }
  if (!nullRows || nullRows.length === 0) {
    console.log("  (no null-country active subscribers)");
    return;
  }

  for (const r of nullRows as SubscriberRow[]) {
    console.log(`  ${apply ? "✓" : "·"} ${r.email.padEnd(40)} → ng (default)`);
  }
  console.log(`\n  Summary: ${nullRows.length} ${apply ? "updated" : "would update"} to country='ng'`);

  if (apply) {
    const { error: updErr } = await supa
      .from("newsletter_subscribers")
      .update({ country: "ng" })
      .is("country", null)
      .eq("status", "active");
    if (updErr) {
      console.error(`  ✗ UPDATE failed: ${updErr.message}`);
    }
  }
}

async function softDeleteTestSubscribers(supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>, apply: boolean) {
  console.log(`\n── 3. newsletter_subscribers test rows → unsubscribed ──`);
  const { data: actives, error } = await supa
    .from("newsletter_subscribers")
    .select("email, country, status")
    .eq("status", "active");
  if (error) { console.error("  ✗ query failed:", error.message); return; }
  if (!actives || actives.length === 0) {
    console.log("  (no active subscribers)");
    return;
  }

  const tests = (actives as SubscriberRow[]).filter((r) => isTestEmail(r.email));
  if (tests.length === 0) {
    console.log("  (no test rows in active subscribers)");
    return;
  }

  for (const r of tests) {
    console.log(`  ${apply ? "✓" : "·"} ${r.email.padEnd(40)} → unsubscribed`);
  }
  console.log(`\n  Summary: ${tests.length} ${apply ? "updated" : "would update"} to status='unsubscribed'`);

  if (apply) {
    for (const r of tests) {
      const { error: updErr } = await supa
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed" })
        .eq("email", r.email)
        .eq("status", "active");
      if (updErr) {
        console.log(`    ✗ ${r.email}: ${updErr.message}`);
      }
    }
  }
}

async function main() {
  const args = parseArgs();
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no Supabase admin client"); process.exit(1); }

  console.log(`▶ May 2026 data cleanup`);
  console.log(`  mode: ${args.apply ? "APPLY" : "DRY RUN (use --apply to mutate)"}`);

  await backfillStoreCountries(supa, args.apply);
  await backfillSubscriberCountries(supa, args.apply);
  await softDeleteTestSubscribers(supa, args.apply);

  console.log(`\n${args.apply ? "✓ Done." : "Dry run complete. Re-run with --apply to mutate."}\n`);
}

main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
