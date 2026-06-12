#!/usr/bin/env tsx
/* Mon/Wed/Fri newsletter digest send.

   Fires AFTER the Mon/Wed/Fri scrape cron finishes ingesting fresh
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
import { unsubscribeLink, unsubscribeHeaders } from "../../src/lib/email/unsubscribe-token";
import { categories } from "../../src/lib/data/categories";
import { pdpUrlForDeal } from "../../src/lib/pdp-url";
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
const TOP_DEALS_OVERALL   = 8;     // cross-category digest
const TOP_DEALS_CATEGORY  = 6;     // category-targeted digest
const LOCAL_QUOTA_RATIO   = 0.625; // ~5 of 8 local, 3 of 8 cross-border (or 4/2 for category digests)
const PER_STORE_CAP       = 2;     // no single store dominates the digest
const PACE_MS_BETWEEN     = 500;   // ~2 emails/sec, safe under Resend free tier (1 req/s headline; bursts allowed)

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
  const provider = await getActiveBrowseProvider();

  /* Same path as /api/deals: origin='all', then split into local +
     cross-border pools and fill each against a quota. The earlier
     branch only gave NG users a mix; UK/US/DE/IN/AE/ZA were filtered
     to cross-border ONLY on the assumption their local catalog was
     too thin to digest. The UK retailer ingest (Argos, Currys, John
     Lewis, ASOS, etc.) closed that gap, so every market now gets the
     same balanced treatment: ~62.5% local picks (what you can buy
     today) + ~37.5% cross-border (what's cheaper if you'll wait for
     shipping). Mirrors the homepage TrendingDeals composition so the
     digest reads like a familiar Havlo slice, not a different product. */
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

  const localPool       = countryFiltered.filter(isLocalToUser);
  const crossBorderPool = countryFiltered.filter((d) => !isLocalToUser(d));

  /* Quota math: round local UP so the digest leans local-first.
     limit=8 -> 5 local + 3 cross-border. limit=6 -> 4 local + 2
     cross-border. */
  const localQuota       = Math.ceil(limit * LOCAL_QUOTA_RATIO);
  const crossBorderQuota = limit - localQuota;

  /* Pick from each pool with a per-store cap so no single retailer
     dominates a slice (e.g. Konga can't take 5 of 5 local slots). */
  function pickFromPool(pool: Deal[], target: number, excludeKeys: Set<string>): Deal[] {
    const perStoreSeen = new Map<string, number>();
    const picks: Deal[] = [];
    for (const d of pool) {
      const key = `${d.storeId}|${d.url}`;
      if (excludeKeys.has(key)) continue;
      const sc = perStoreSeen.get(d.storeId) ?? 0;
      if (sc >= PER_STORE_CAP) continue;
      perStoreSeen.set(d.storeId, sc + 1);
      picks.push(d);
      if (picks.length >= target) break;
    }
    return picks;
  }

  const seen = new Set<string>();
  const localPicks       = pickFromPool(localPool,       localQuota,       seen);
  localPicks.forEach((d) => seen.add(`${d.storeId}|${d.url}`));
  const crossBorderPicks = pickFromPool(crossBorderPool, crossBorderQuota, seen);
  crossBorderPicks.forEach((d) => seen.add(`${d.storeId}|${d.url}`));

  const picks: Deal[] = [...localPicks, ...crossBorderPicks];

  /* Backfill: if one bucket underfilled its quota (thin local
     catalog for an emerging market, or zero cross-border for a
     mature one), top up from the OTHER bucket so the digest ships
     a full N deals. Better to send 8 deals (some imbalanced) than
     6 deals (a clean split that visibly underdelivers). */
  if (picks.length < limit) {
    const backfillPool = localPicks.length < localQuota
      ? crossBorderPool
      : localPool;
    const topUp = pickFromPool(backfillPool, limit - picks.length, seen);
    picks.push(...topUp);
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
      /* Link to OUR PDP, not a signed click-through straight to the
         merchant. Landing on the product page first means the visit is
         tracked (pdp_views + analytics), the reader sees the price
         history / cross-store compare before buying, and the affiliate
         click still happens via the PDP's "Visit store" CTA. */
      url:             `${SITE_URL}${pdpUrlForDeal(country.code, d)}`,
      /* Product photo (June 2026) — dealCard renders an 80px thumb
         when present, text-only otherwise. emailImageUrl inside the
         template handles proxying/absolutizing, so the raw merchant
         or Storage URL goes through as-is. */
      imageUrl:        d.imageUrl ?? null,
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
    /* Per-recipient unsubscribe. The deal DATA is cached per (country,
       category) bucket, but the digest itself is rendered fresh for
       each subscriber here, so signing the link with THIS inbox's
       address is safe — no cross-recipient leakage. */
    const email = newsletterDigest({
      country:        cc,
      category:       cat || null,
      categoryLabel:  catLabel,
      deals,
      unsubscribeUrl: unsubscribeLink(sub.email),
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
      /* RFC 8058 one-click unsubscribe. Gmail / Apple Mail / Yahoo
         surface a native "Unsubscribe" control from these and POST the
         signed https target — required for bulk-sender compliance. */
      headers: unsubscribeHeaders(sub.email),
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
