#!/usr/bin/env tsx
/* Twice-weekly newsletter digest send.

   Fires AFTER the Mon + Thurs scrape cron finishes ingesting fresh
   inventory (.github/workflows/scrape-deals.yml). The cadence is:

       scrape  →  ingest-aliexpress / serpapi / uk-retailers
                                                                 ↘
                                                                  dedup
                                                                    ↓
                                                            send-newsletter

   Pipeline:
     1. Pull active newsletter_subscribers grouped by (country, category)
     2. For each unique country, fetch the top deals (same path as
        /api/deals — same filtering, same INTL/local bucketing)
     3. For category-targeted subscribers, narrow to their slug
     4. Build the digest email with country-aware prices
     5. Send via Resend, paced at ~2 req/s to stay under the free-tier
        rate limit
     6. Log totals: subscribers attempted / sent / failed / skipped

   Usage:
     # Preview without sending (counts + sample subjects only):
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/send-newsletter.ts --dry-run

     # Send to a single email (live test):
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/send-newsletter.ts --only=you@example.com

     # Production send (every active subscriber):
     npx tsx --tsconfig tsconfig.scripts.json scripts/cron/send-newsletter.ts

   The script is safe to run manually OR from CI. CI invocation
   should rely on SUPABASE_SERVICE_ROLE_KEY + RESEND_API_KEY being
   present as workflow secrets. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { getSupabaseAdmin } from "../../src/lib/providers/db-client";
import { getActiveBrowseProvider } from "../../src/lib/providers";
import { filterDealsForCountry, getCountry, inferStoreCountry, formatLocal, USD_FX } from "../../src/lib/country";
import { newsletterDigest } from "../../src/lib/email/templates/newsletter-digest";
import { sendEmail } from "../../src/lib/email/send";
import { categories } from "../../src/lib/data/categories";
import { getClickThroughUrl } from "../../src/lib/utils";
import type { Country } from "../../src/lib/country";
import type { Deal } from "../../src/types";

interface Args {
  dryRun: boolean;
  only:   string | null;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false, only: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--only=")) args.only = arg.slice("--only=".length).toLowerCase();
  }
  return args;
}

const SITE_URL = "https://havlo.io";

/* Tunables — adjust if subscriber base or send budget changes. */
const TOP_DEALS_OVERALL   = 8;   // cross-category digest
const TOP_DEALS_CATEGORY  = 6;   // category-targeted digest
const PACE_MS_BETWEEN     = 500; // ~2 emails/sec, safe under Resend free tier (1 req/s headline; bursts allowed)

interface SubscriberRow {
  email:    string;
  country:  string | null;
  category: string | null;
}

/* Convert a deal price (native currency on the row) into the user's
   country currency for the digest. Same FX path the on-site cards
   use, just inlined here so the cron doesn't pull in client helpers. */
function priceInUserCurrency(amount: number, dealCurrency: string, country: Country): number {
  const dealCcy = dealCurrency as Country["currency"];
  if (dealCcy === country.currency) return Math.round(amount);
  const inUsd = dealCcy === "USD" ? amount : amount / (USD_FX[dealCcy] ?? 1);
  return Math.round(inUsd * (USD_FX[country.currency] ?? 1));
}

/* Builds the digest payload for one (country, category) bucket.
   Returns null when there aren't enough fresh deals — better to
   skip than send a 0-deal email. */
async function buildDigestDeals(
  countryCode: string,
  category:    string | null,
  limit:       number,
): Promise<Array<Parameters<typeof newsletterDigest>[0]["deals"][number]>> {
  const country = getCountry(countryCode);
  const isNG = country.code === "ng";
  const provider = await getActiveBrowseProvider();

  /* Same path as /api/deals: origin='all', then filter by country
     gate + (for non-NG) drop locals so the digest is cross-border
     for non-NG markets where local catalog is thinner. */
  const raw = await provider.fetchDeals({
    categorySlug: category ?? undefined,
    minDiscount:  10,                 // a small floor — the digest is "worth opening" content
    sort:         "discount",
    origin:       "all",
  });

  const countryFiltered = filterDealsForCountry(raw, country);
  const isLocalToUser = (d: Deal): boolean => {
    const sc = inferStoreCountry(d.storeId, d.storeName);
    if (sc !== null) return sc.toLowerCase() === country.code.toLowerCase();
    return d.currency === country.currency;
  };
  const effective = isNG
    ? countryFiltered
    : countryFiltered.filter((d) => !isLocalToUser(d));

  /* Top N by discount, with a per-store cap so one store can't
     dominate the digest. */
  const perStoreSeen = new Map<string, number>();
  const PER_STORE_CAP = 2;
  const picks: Deal[] = [];
  for (const d of effective) {
    const sc = perStoreSeen.get(d.storeId) ?? 0;
    if (sc >= PER_STORE_CAP) continue;
    perStoreSeen.set(d.storeId, sc + 1);
    picks.push(d);
    if (picks.length >= limit) break;
  }

  return picks.map((d) => {
    const sale = priceInUserCurrency(d.salePrice,     d.currency, country);
    const orig = priceInUserCurrency(d.originalPrice, d.currency, country);
    return {
      title:           d.title.slice(0, 80),
      priceDisplay:    formatLocal(sale, country),
      originalDisplay: d.originalPrice > d.salePrice ? formatLocal(orig, country) : null,
      discountPercent: d.discountPercent ?? 0,
      storeName:       d.storeName,
      url:             `${SITE_URL}${getClickThroughUrl(d)}`,
    };
  });
}

async function main() {
  const args = parseArgs();
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("✗ no Supabase admin client"); process.exit(1); }

  console.log(`▶ Newsletter digest send`);
  console.log(`  dryRun: ${args.dryRun}`);
  console.log(`  only:   ${args.only ?? "(every active subscriber)"}\n`);

  /* 1. Pull active subscribers. The unique constraint is (email,
     source) so a user could be on the list multiple times if they
     subscribed from different surfaces. Dedup to (email, country,
     category) on this side — one digest per inbox, period. */
  let query = supa
    .from("newsletter_subscribers")
    .select("email, country, category")
    .eq("status", "active");
  if (args.only) query = query.eq("email", args.only);

  const { data: rows, error } = await query;
  if (error) { console.error("✗ subscriber query failed:", error.message); process.exit(1); }
  if (!rows || rows.length === 0) {
    console.log(`No active subscribers${args.only ? ` matching ${args.only}` : ""}. Nothing to send.`);
    return;
  }

  /* Dedup to (email, country, category) tuple. Last write wins
     (Map.set semantics) which is fine — they all have the same
     content from this surface anyway. */
  const byKey = new Map<string, SubscriberRow>();
  for (const r of rows as SubscriberRow[]) {
    const key = `${r.email.toLowerCase()}|${(r.country ?? "ng").toLowerCase()}|${r.category ?? ""}`;
    if (!byKey.has(key)) byKey.set(key, r);
  }
  const subscribers = Array.from(byKey.values());
  console.log(`Active subscribers (deduped): ${subscribers.length}\n`);

  /* 2. Pre-compute one deal set per (country, category) so we don't
     re-query the catalog for every subscriber. Subscribers in the
     same (country, category) bucket get the same digest. */
  const dealCache = new Map<string, Awaited<ReturnType<typeof buildDigestDeals>>>();
  const buckets = new Set<string>();
  for (const s of subscribers) {
    const cc = (s.country ?? "ng").toLowerCase();
    const cat = s.category ?? "";
    buckets.add(`${cc}|${cat}`);
  }
  for (const b of Array.from(buckets)) {
    const [cc, cat] = b.split("|");
    const limit = cat ? TOP_DEALS_CATEGORY : TOP_DEALS_OVERALL;
    const deals = await buildDigestDeals(cc, cat || null, limit);
    dealCache.set(b, deals);
    console.log(`  bucket ${cc.toUpperCase()}${cat ? ` · ${cat}` : ""}: ${deals.length} deal(s)`);
  }
  console.log();

  /* 3. Send. Skip subscribers whose bucket came back empty — better
     to silently no-op than send a barren digest. */
  let sent    = 0;
  let failed  = 0;
  let skipped = 0;

  for (const sub of subscribers) {
    const cc  = (sub.country ?? "ng").toLowerCase();
    const cat = sub.category ?? "";
    const key = `${cc}|${cat}`;
    const deals = dealCache.get(key) ?? [];
    if (deals.length === 0) {
      console.log(`   skip   ${sub.email} (no fresh deals in ${key})`);
      skipped++;
      continue;
    }

    const catLabel = cat
      ? categories.find((c) => c.slug === cat)?.name ?? cat
      : undefined;
    const email = newsletterDigest({
      country:       cc,
      category:      cat || null,
      categoryLabel: catLabel,
      deals,
    });

    if (args.dryRun) {
      console.log(`   DRY    ${sub.email} ← "${email.subject}" (${deals.length} deal(s))`);
      sent++;
      continue;
    }

    const result = await sendEmail({
      to:      sub.email,
      subject: email.subject,
      text:    email.text,
      html:    email.html,
      tags: [
        { name: "category", value: "newsletter-digest" },
        { name: "country",  value: cc },
        { name: "slug",     value: cat || "all" },
      ],
    });
    if (result.ok) {
      console.log(`   ✓ ${sub.email}`);
      sent++;
    } else {
      console.log(`   ✗ ${sub.email}: ${result.error}`);
      failed++;
    }

    /* Pace ourselves under Resend's free-tier rate limit. */
    if (sent + failed < subscribers.length) {
      await new Promise((r) => setTimeout(r, PACE_MS_BETWEEN));
    }
  }

  console.log(`\nDone. sent=${sent} failed=${failed} skipped=${skipped} ${args.dryRun ? "(dry run)" : ""}`);
}

main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
