#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Havlo data health check.

   Single-script regression detector for the ingest-pipeline integrity
   issues the Phase 3-6 audit surfaced. Each "check" probes the DB
   and compares the result against a documented threshold. Any breach
   becomes a finding in the alert email.

   Why a single script (not multiple probes):
     • One run = one network connection pool, fewer round trips.
     • Identical thresholds across check invocations, no drift.
     • One email per run with a unified summary, instead of N emails.

   Usage:
     npm run health-check                # run + email only on issues
     npm run health-check -- --always-email   # email even on green
     npm run health-check -- --dry-run        # log only, no email

   Wiring:
     .github/workflows/health-check.yml runs this on a weekly cron
     (Sun 06:00 UTC, 2h after the maintenance pass). Env vars:
       SUPABASE_URL                     (required)
       SUPABASE_SERVICE_ROLE_KEY        (required)
       RESEND_API_KEY                   (required for email)
       HEALTH_CHECK_RECIPIENT           (email to alert; default falls
                                         back to ADMIN_EMAIL → no-op)

   Exit codes:
     0  — all checks passed
     1  — at least one finding (workflow fails loudly in GH UI too)
     2  — script error before checks could run (DB unreachable, etc.)
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { sendEmail } from "../src/lib/email/send";
import { shellMarketing, tokens, escapeHtml as esc, spacer } from "../src/lib/email/templates/_layout";
import { merchantSearchUrl, smartFallbackUrl, merchantHomepage } from "../src/lib/merchant-search-urls";
import { isGoogleRelay } from "../src/lib/url-helpers";

const ALWAYS_EMAIL = process.argv.includes("--always-email");
const DRY_RUN      = process.argv.includes("--dry-run");
const RECIPIENT    = (process.env.HEALTH_CHECK_RECIPIENT ?? process.env.ADMIN_EMAIL ?? "").trim();

type Severity = "ERROR" | "WARN" | "INFO";

interface Finding {
  severity:  Severity;
  /** Short check id (no spaces) for grep + future trend tracking. */
  id:        string;
  /** One-line headline. */
  headline:  string;
  /** Measured value. */
  value:     number;
  /** Threshold that was breached. Omit on INFO findings. */
  threshold?: number;
  /** Optional context — what to do next, or a sample row. */
  detail?:   string;
}

interface Baseline {
  totalProducts:   number;
  totalOffers:     number;
  inStockOffers:   number;
  totalStores:     number;
  /** Where an in-stock click actually lands, mirroring the /api/go
      resolution chain. pdp = direct passthrough; search = curated
      search page; home = bare merchant homepage (floor/guess);
      bounce = no merchant signal, falls through to Havlo /compare. */
  landing:         { pdp: number; search: number; home: number; bounce: number };
}

/* ── Shared helpers ──────────────────────────────────────────────── */

async function fetchPaged<T>(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const q = filters(supa.from(table).select(select)).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) { console.warn(`fetch err ${error.message}`); break; }
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function count(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<number> {
  const base = supa.from(table).select("*", { count: "exact", head: true });
  const { count: n, error } = await filters(base);
  return error ? -1 : (n ?? 0);
}

/* ── Thresholds ──────────────────────────────────────────────────
   Document each threshold's rationale so future me knows whether
   to bump it when the catalog grows. All values are inclusive
   (breached = strictly > threshold). */

const THRESHOLDS = {
  /* Sentinels are a SCRUBBER MISFIRE — if ANY row carries the
     [BLOCKED: …] marker in title / store name / store id, the
     pre-filter in ingestDeals failed. Zero tolerance. */
  sentinel: 0,

  /* NULL-country stores excluding known global cross-border. After
     the Phase 3 cleanup this sat at 45 (legitimately multi-market
     stores). A rise above 100 means the three-layer country
     resolution in dealToStoreRow stopped working for new ingests. */
  nullCountryStores: 100,

  /* Products with zero offers pointing at them. The orphan
     reconciliation in ingestDeals + the Sunday maintenance pass
     should keep this near zero. */
  orphanProducts: 50,

  /* In-stock offers older than the TTL_DAYS=30 sweep window.
     Sweep skips stores nothing actively ingests; a rise here
     means a scraper went dark without anyone noticing. */
  staleInStock: 100,

  /* Title placeholders that escaped cleanProductTitle. The strip
     handles Generic / Unbranded / No Brand prefixes; non-zero
     count means an ingest path is bypassing the cleaner. */
  titlePlaceholders: 0,

  /* HTML tags in stored titles. cleanProductTitle now strips
     them at ingest; non-zero count means a path is bypassing. */
  htmlInTitles: 10,

  /* is_deal=true but the price is broken (≤0 or NULL). is_deal
     is supposed to be `salePrice > 0` per dealToOfferRow. */
  badPriceWithIsDeal: 0,

  /* (product_id, store_id) pairs with > 50 offers each — the
     URL-rotation bloat class. canonicaliseOfferUrl + the
     AliExpress product_detail_url fix cleaned this up; a
     re-emergence means a new merchant has rotating tracking
     params we haven't stripped yet. */
  bloatedPairs: 0,

  /* Catastrophic drop guard. In-stock offers below this floor
     suggests a mass-sweep or DB issue. */
  minInStockOffers: 8000,

  /* ── Outbound landing-split guards (added after the v8-v11 merchant
     curation pass that took CURATED relay coverage to 3,018/3,642 and
     cut Havlo bounces to 62). These catch the split regressing as new
     stores get ingested. ── */

  /* In-stock clicks that bounce to Havlo /compare because the store
     has no MERCHANTS entry AND no usable homepage guess. The worst
     UX tier. Sat at 62 after v11. A rise past 100 means new stores
     ingested without any merchant signal — usually a batch from one
     new high-volume store (see uncurated_head_store finding). */
  bounceOffers: 100,

  /* % of in-stock clicks landing on a bare merchant HOMEPAGE instead
     of a product or search page. Sat at ~5.9% after v11. Percentage
     (not absolute) so it stays meaningful as the catalog grows. A
     rise past 9% means either a curated searchUrl rotted (search ->
     home drift) or many new stores landed with only a homepage floor. */
  homeOffersPct: 9,

  /* Per-store trigger: a SINGLE store sending this many relay clicks
     to a fallback (homepage or bounce) is a high-value curation
     target. 10 is above the steady-state tail (post-v11 the worst
     uncurated store is in single digits) so this stays quiet until a
     genuinely new high-volume store appears — exactly the "new store
     just got ingested" signal. Names the store so the fix is a
     one-line MERCHANTS addition. */
  headStoreRelayOffers: 10,
};

/* ── Checks ──────────────────────────────────────────────────────
   Each check is async, returns 0..N findings. Run sequentially so
   the DB connection pool isn't hammered; the whole run finishes
   in 5-10s. */

async function runChecks(supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<{ baseline: Baseline; findings: Finding[] }> {
  const findings: Finding[] = [];

  /* Baseline counts — emitted as INFO regardless of pass/fail
     so the email body always has the headline numbers. */
  const totalProducts = await count(supa, "products", (q) => q);
  const totalOffers   = await count(supa, "offers",   (q) => q);
  const inStockOffers = await count(supa, "offers",   (q) => q.eq("in_stock", true));
  const totalStores   = await count(supa, "stores",   (q) => q);

  /* Outbound landing split — where every in-stock click actually goes,
     replaying the /api/go resolution order per offer:
       not a Google relay url          -> PDP (direct passthrough)
       merchantSearchUrl returns a url
         embedding the sentinel query   -> SEARCH (real search page)
         else (homepage floor)          -> HOME
       smartFallbackUrl / merchantHomepage hit -> HOME (guess)
       nothing                          -> BOUNCE (Havlo /compare)
     A fixed sentinel query lets us tell a real search URL (which embeds
     the query) from a homepage floor (which does not) without depending
     on any particular product title. */
  const landingRows = await fetchPaged<{ url: string; store_id: string; stores: { name: string } | { name: string }[] | null }>(
    supa, "offers", "url, store_id, stores(name)", (q) => q.eq("in_stock", true),
  );
  const SENTINEL = "Zq9SENTINELq9Z";
  const land = { pdp: 0, search: 0, home: 0, bounce: 0 };
  const offenders = new Map<string, { name: string; home: number; bounce: number }>();
  for (const r of landingRows) {
    const sf = r.stores; const store = Array.isArray(sf) ? sf[0] : sf;
    const name = store?.name ?? r.store_id;
    let where: "pdp" | "search" | "home" | "bounce";
    if (!r.url || !isGoogleRelay(r.url)) {
      where = "pdp";
    } else {
      const s = merchantSearchUrl(r.store_id, name, SENTINEL);
      if (s) where = s.url.includes(SENTINEL) ? "search" : "home";
      else if (smartFallbackUrl(r.store_id, name, SENTINEL)) where = "home";
      else if (merchantHomepage(r.store_id, name)) where = "home";
      else where = "bounce";
    }
    land[where] += 1;
    if (where === "home" || where === "bounce") {
      const cur = offenders.get(r.store_id) ?? { name, home: 0, bounce: 0 };
      cur[where] += 1; offenders.set(r.store_id, cur);
    }
  }

  const baseline: Baseline = { totalProducts, totalOffers, inStockOffers, totalStores, landing: land };

  /* Landing A — bounce volume (no merchant route at all). */
  if (land.bounce > THRESHOLDS.bounceOffers) {
    findings.push({
      severity:  "WARN",
      id:        "outbound_bounce",
      headline:  `In-stock clicks bouncing to Havlo /compare (no merchant route)`,
      value:     land.bounce,
      threshold: THRESHOLDS.bounceOffers,
      detail:    `These relay offers have no MERCHANTS entry and no usable homepage guess, so the click lands on Havlo's own compare page instead of the merchant. Usually means a new store was ingested with no merchant signal — see the uncurated_head_store finding for which one.`,
    });
  }

  /* Landing B — homepage drift (search -> home, or many uncurated stores). */
  const homePct = baseline.inStockOffers > 0 ? (land.home / baseline.inStockOffers) * 100 : 0;
  if (homePct > THRESHOLDS.homeOffersPct) {
    findings.push({
      severity:  "WARN",
      id:        "outbound_home_drift",
      headline:  `In-stock clicks landing on a bare merchant homepage`,
      value:     land.home,
      threshold: Math.round((baseline.inStockOffers * THRESHOLDS.homeOffersPct) / 100),
      detail:    `${homePct.toFixed(1)}% of in-stock clicks hit a homepage instead of a product or search page (bar: ${THRESHOLDS.homeOffersPct}%). A curated searchUrl may have rotted (search -> home), or many new stores landed with only a homepage floor. Check recent MERCHANTS entries and re-probe their search URLs.`,
    });
  }

  /* Landing C — per-store worklist: the actionable "go curate this" signal.
     Quiet until one store crosses headStoreRelayOffers, then names the
     top offenders so the fix is a one-line MERCHANTS addition. */
  const ranked = [...offenders.entries()]
    .map(([id, v]) => ({ id, relay: v.home + v.bounce, home: v.home, bounce: v.bounce }))
    .sort((a, b) => b.relay - a.relay);
  const worst = ranked[0];
  if (worst && worst.relay >= THRESHOLDS.headStoreRelayOffers) {
    const list = ranked
      .filter((o) => o.relay >= THRESHOLDS.headStoreRelayOffers)
      .slice(0, 6)
      .map((o) => `${o.id} (${o.relay} relay: ${o.bounce} bounce / ${o.home} home)`)
      .join(", ");
    findings.push({
      severity:  "WARN",
      id:        "uncurated_head_store",
      headline:  `Store(s) sending ${THRESHOLDS.headStoreRelayOffers}+ relay clicks to a fallback`,
      value:     worst.relay,
      threshold: THRESHOLDS.headStoreRelayOffers,
      detail:    `Add a MERCHANTS entry in src/lib/merchant-search-urls.ts (probe the search URL live first): ${list}.`,
    });
  }

  /* Catastrophic-drop floor. */
  if (inStockOffers < THRESHOLDS.minInStockOffers) {
    findings.push({
      severity:  "ERROR",
      id:        "instock_floor",
      headline:  `In-stock offers dropped below ${THRESHOLDS.minInStockOffers}`,
      value:     inStockOffers,
      threshold: THRESHOLDS.minInStockOffers,
      detail:    "Possible mass sweep or DB outage. Check ingestion_runs for recent failures.",
    });
  }

  /* 1. Sentinel leaks (title + store name + store id). */
  const sentTitle     = await count(supa, "products", (q) => q.ilike("title", "%[BLOCKED:%"));
  const sentStoreName = await count(supa, "stores",   (q) => q.ilike("name", "%[BLOCKED:%"));
  const sentStoreId   = await count(supa, "stores",   (q) => q.ilike("id",   "%[BLOCKED:%"));
  const sentinelTotal = sentTitle + sentStoreName + sentStoreId;
  if (sentinelTotal > THRESHOLDS.sentinel) {
    findings.push({
      severity:  "ERROR",
      id:        "sentinel_leak",
      headline:  `[BLOCKED:…] scrubber-sentinel rows in catalog`,
      value:     sentinelTotal,
      threshold: THRESHOLDS.sentinel,
      detail:    `breakdown: products.title=${sentTitle}, stores.name=${sentStoreName}, stores.id=${sentStoreId}. Ingest-time isBlockedSentinel() pre-filter likely bypassed.`,
    });
  }

  /* 2. NULL-country stores (excluding known cross-border globals). */
  const stores = await fetchPaged<{ id: string; name: string; country: string | null }>(
    supa, "stores", "id, name, country", (q) => q,
  );
  const KNOWN_GLOBAL = ["aliexpress", "shein", "temu", "dhgate", "banggood", "wish.com", "alibaba", "trendyol"];
  const isKnownGlobal = (id: string, name: string) => {
    const lc = `${id} ${name}`.toLowerCase();
    return KNOWN_GLOBAL.some((g) => lc.includes(g));
  };
  const nullCountry = stores.filter((s) => !s.country && !isKnownGlobal(s.id, s.name));
  if (nullCountry.length > THRESHOLDS.nullCountryStores) {
    findings.push({
      severity:  "WARN",
      id:        "null_country_stores",
      headline:  `Stores with NULL country (excl known globals)`,
      value:     nullCountry.length,
      threshold: THRESHOLDS.nullCountryStores,
      detail:    `sample: ${nullCountry.slice(0, 5).map((s) => s.id).join(", ")}. Three-layer country resolution in dealToStoreRow may have regressed.`,
    });
  }

  /* 3. Orphan products. */
  const productIds  = await fetchPaged<{ id: string }>(supa, "products", "id", (q) => q);
  const offerProdIds = await fetchPaged<{ product_id: string }>(supa, "offers", "product_id", (q) => q);
  const referenced  = new Set(offerProdIds.map((r) => r.product_id));
  const orphans     = productIds.filter((p) => !referenced.has(p.id));
  if (orphans.length > THRESHOLDS.orphanProducts) {
    findings.push({
      severity:  "WARN",
      id:        "orphan_products",
      headline:  `Products with zero offers`,
      value:     orphans.length,
      threshold: THRESHOLDS.orphanProducts,
      detail:    `Orphan reconciliation in ingestDeals may not be firing. Re-run scripts/phase3-data-cleanup.ts to clean.`,
    });
  }

  /* 4. Stale in_stock offers. */
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const staleCount = await count(supa, "offers",
    (q) => q.eq("in_stock", true).lt("last_seen_at", thirtyDaysAgo),
  );
  if (staleCount > THRESHOLDS.staleInStock) {
    findings.push({
      severity:  "WARN",
      id:        "stale_instock",
      headline:  `Stale in_stock offers (>30d unseen)`,
      value:     staleCount,
      threshold: THRESHOLDS.staleInStock,
      detail:    `Per-store TTL sweep didn't fire — likely because the store hasn't been ingested recently. Check ingestion_runs by store_id.`,
    });
  }

  /* 5. Title placeholders. */
  const placeholderCount = await count(supa, "products",
    (q) => q.or("title.ilike.Generic %,title.ilike.Unbranded %,title.ilike.No Brand %"),
  );
  if (placeholderCount > THRESHOLDS.titlePlaceholders) {
    findings.push({
      severity:  "WARN",
      id:        "title_placeholders",
      headline:  `Titles with leaked Generic/Unbranded/No Brand prefix`,
      value:     placeholderCount,
      threshold: THRESHOLDS.titlePlaceholders,
      detail:    `cleanProductTitle in ingestion.ts strips these — a regression here means an ingest path is bypassing it.`,
    });
  }

  /* 6. HTML tags in titles. */
  /* Postgres ILIKE pattern: any <X> tag. Use the bracket-open + non-bracket-close pattern. */
  const htmlCount = await count(supa, "products", (q) => q.ilike("title", "%<%>%"));
  if (htmlCount > THRESHOLDS.htmlInTitles) {
    findings.push({
      severity:  "WARN",
      id:        "html_in_titles",
      headline:  `Product titles containing HTML tags`,
      value:     htmlCount,
      threshold: THRESHOLDS.htmlInTitles,
      detail:    `cleanProductTitle strips HTML — non-zero growth means a provider is bypassing the cleaner.`,
    });
  }

  /* 7. is_deal=true with broken price. */
  const badPriceDeal = await count(supa, "offers",
    (q) => q.eq("is_deal", true).or("current_price.is.null,current_price.eq.0,current_price.lt.0"),
  );
  if (badPriceDeal > THRESHOLDS.badPriceWithIsDeal) {
    findings.push({
      severity:  "ERROR",
      id:        "bad_price_isdeal",
      headline:  `is_deal=true offers with price ≤ 0 or NULL`,
      value:     badPriceDeal,
      threshold: THRESHOLDS.badPriceWithIsDeal,
      detail:    `Shouldn't happen — dealToOfferRow gates is_deal on salePrice > 0. Investigate ingestion_runs for affected offers.`,
    });
  }

  /* 8. Bloated (product, store) pairs (>50 offers each). */
  const offerPairs = await fetchPaged<{ product_id: string; store_id: string }>(
    supa, "offers", "product_id, store_id", (q) => q,
  );
  const pairCounts = new Map<string, number>();
  for (const o of offerPairs) {
    const k = `${o.product_id}|${o.store_id}`;
    pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
  }
  let bloatedPairs = 0;
  let topPair: { k: string; n: number } | null = null;
  pairCounts.forEach((n, k) => {
    if (n > 50) {
      bloatedPairs++;
      if (!topPair || n > topPair.n) topPair = { k, n };
    }
  });
  if (bloatedPairs > THRESHOLDS.bloatedPairs) {
    findings.push({
      severity:  "WARN",
      id:        "bloated_pairs",
      headline:  `(product_id, store_id) pairs with > 50 offers`,
      value:     bloatedPairs,
      threshold: THRESHOLDS.bloatedPairs,
      detail:    topPair
        ? `worst pair: ${(topPair as { k: string; n: number }).k} → ${(topPair as { k: string; n: number }).n} offers. URL canonicalisation may be missing a tracking-param key for this merchant.`
        : "URL canonicalisation may be missing a tracking-param key for some merchant.",
    });
  }

  return { baseline, findings };
}

/* ── Email body builders ─────────────────────────────────────────
   Tight inline HTML + matching plain text. No external dependencies,
   no template engine — keep the alert script free of extra moving
   parts so it can't fail for cosmetic reasons. */

function buildSubject(findings: Finding[]): string {
  const errors = findings.filter((f) => f.severity === "ERROR").length;
  const warns  = findings.filter((f) => f.severity === "WARN").length;
  if (errors === 0 && warns === 0) return "✓ Havlo data health: all checks passed";
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  if (warns > 0)  parts.push(`${warns} warning${warns === 1 ? "" : "s"}`);
  return `⚠ Havlo data health: ${parts.join(", ")}`;
}

/* Status tone — green when clean, red on error, amber on warn-only. */
function statusTone(findings: Finding[]): { hex: string; label: string; bg: string } {
  if (findings.length === 0)                                 return { hex: tokens.success, label: "All clear", bg: tokens.successBg };
  if (findings.some((f) => f.severity === "ERROR"))          return { hex: "#DC2626", label: "Action needed", bg: "#FEF2F2" };
  return                                                            { hex: "#D97706", label: "Worth a look",   bg: "#FFFBEB" };
}

/* One metric tile, 2-per-row by table cell. Cell padding lives on the
   wrapper <td> (16px) so adjacent tiles can't bleed into each other —
   the bug Gmail mobile showed first time around was four 25%-wide
   cells with zero padding rendering as a single unbroken "PRODUCTSOFFERS
   IN-STOCK STORES" string. */
function metricTile(label: string, value: number): string {
  return `
    <td width="50%" style="padding:8px;" valign="top">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${tokens.surface};border:1px solid ${tokens.border};border-radius:10px;" class="bg-card border">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-family:${tokens.fontFamily};font-size:10px;font-weight:600;color:${tokens.ink3};text-transform:uppercase;letter-spacing:0.1em;line-height:1.2;" class="text-ink-3">
              ${esc(label)}
            </div>
            <div style="font-family:${tokens.fontFamily};font-size:22px;font-weight:700;color:${tokens.ink};letter-spacing:-0.01em;line-height:1.2;margin-top:6px;" class="text-ink">
              ${value.toLocaleString()}
            </div>
          </td>
        </tr>
      </table>
    </td>`;
}

/* Landing tile — like metricTile but with a percent-of-in-stock sub-figure,
   since "929 homepages" only means something next to the total. */
function landingTile(label: string, value: number, total: number): string {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return `
    <td width="50%" style="padding:8px;" valign="top">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${tokens.surface};border:1px solid ${tokens.border};border-radius:10px;" class="bg-card border">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-family:${tokens.fontFamily};font-size:10px;font-weight:600;color:${tokens.ink3};text-transform:uppercase;letter-spacing:0.1em;line-height:1.2;" class="text-ink-3">
              ${esc(label)}
            </div>
            <div style="font-family:${tokens.fontFamily};font-size:22px;font-weight:700;color:${tokens.ink};letter-spacing:-0.01em;line-height:1.2;margin-top:6px;" class="text-ink">
              ${value.toLocaleString()}<span style="font-size:13px;font-weight:600;color:${tokens.ink3};margin-left:6px;" class="text-ink-3">${pct}%</span>
            </div>
          </td>
        </tr>
      </table>
    </td>`;
}

/* One finding card. Inline color tone per severity stays legible in
   both light + dark mode because the foreground colors are hand-picked
   for sufficient contrast against the surface background. */
function findingCard(f: Finding): string {
  const sevHex = f.severity === "ERROR" ? "#DC2626" : "#D97706";
  return `
    <tr>
      <td class="px-mobile" style="padding:0 32px 12px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${tokens.surface};border:1px solid ${tokens.border};border-radius:10px;" class="bg-card border">
          <tr>
            <td style="padding:16px 18px;">
              <div style="font-family:${tokens.fontFamily};font-size:10px;font-weight:700;color:${sevHex};text-transform:uppercase;letter-spacing:0.1em;line-height:1.2;">
                ${esc(f.severity)} · ${esc(f.id)}
              </div>
              <div style="font-family:${tokens.fontFamily};font-size:15px;font-weight:600;color:${tokens.ink};margin-top:6px;line-height:1.35;" class="text-ink">
                ${esc(f.headline)}
              </div>
              <div style="font-family:${tokens.fontFamily};font-size:13px;color:${tokens.ink2};margin-top:8px;line-height:1.5;" class="text-ink-2">
                Measured <strong style="color:${tokens.ink};" class="text-ink">${f.value.toLocaleString()}</strong>${
                  f.threshold !== undefined
                    ? ` &nbsp;·&nbsp; Threshold ${f.threshold.toLocaleString()}`
                    : ""
                }
              </div>
              ${f.detail ? `
                <div style="font-family:${tokens.fontFamily};font-size:13px;color:${tokens.ink2};margin-top:10px;line-height:1.55;" class="text-ink-2">
                  ${esc(f.detail)}
                </div>
              ` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildEmailHtml(baseline: Baseline, findings: Finding[]): string {
  const tone = statusTone(findings);
  const headline = findings.length === 0
    ? "All checks passed"
    : `${findings.length} ${findings.length === 1 ? "finding" : "findings"} need${findings.length === 1 ? "s" : ""} attention`;

  /* Status pill at the top — small, color-coded, sits above the H1. */
  const statusPill = `
    <tr>
      <td class="px-mobile" style="padding:0 32px 8px 32px;">
        <span style="display:inline-block;font-family:${tokens.fontFamily};font-size:11px;font-weight:600;color:${tone.hex};background-color:${tone.bg};padding:5px 10px;border-radius:999px;letter-spacing:0.05em;text-transform:uppercase;">
          ${esc(tone.label)}
        </span>
      </td>
    </tr>`;

  const heading = `
    <tr>
      <td class="px-mobile" style="padding:0 32px 8px 32px;">
        <h1 class="h1-mobile text-ink" style="margin:0;font-family:${tokens.fontFamily};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${tokens.ink};">
          ${esc(headline)}
        </h1>
      </td>
    </tr>`;

  const meta = `
    <tr>
      <td class="px-mobile" style="padding:0 32px 20px 32px;">
        <p class="text-ink-2" style="margin:0;font-family:${tokens.fontFamily};font-size:13px;line-height:1.5;color:${tokens.ink2};">
          Data health check · ${esc(new Date().toUTCString())}
        </p>
      </td>
    </tr>`;

  /* 2x2 grid of metric tiles. Each row is a separate table so spacing
     between rows comes from the table-level margins, not from cells
     that some clients collapse. */
  const metrics = `
    <tr>
      <td class="px-mobile" style="padding:0 24px 4px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            ${metricTile("Products",     baseline.totalProducts)}
            ${metricTile("Offers",       baseline.totalOffers)}
          </tr>
          <tr>
            ${metricTile("In-stock",     baseline.inStockOffers)}
            ${metricTile("Stores",       baseline.totalStores)}
          </tr>
        </table>
      </td>
    </tr>`;

  /* Outbound landing split — always shown so the PDP/search/home/bounce
     trend is visible at a glance even on an otherwise-green week. */
  const total = baseline.inStockOffers;
  const landingMetrics = `
    <tr>
      <td class="px-mobile" style="padding:14px 32px 2px 32px;">
        <div style="font-family:${tokens.fontFamily};font-size:11px;font-weight:700;color:${tokens.ink3};text-transform:uppercase;letter-spacing:0.08em;" class="text-ink-3">
          Where in-stock clicks land
        </div>
      </td>
    </tr>
    <tr>
      <td class="px-mobile" style="padding:0 24px 4px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            ${landingTile("Product page",      baseline.landing.pdp,    total)}
            ${landingTile("Search results",    baseline.landing.search, total)}
          </tr>
          <tr>
            ${landingTile("Merchant homepage", baseline.landing.home,   total)}
            ${landingTile("Bounce to /compare", baseline.landing.bounce, total)}
          </tr>
        </table>
      </td>
    </tr>`;

  /* Findings section — only rendered when there's something to show.
     When all-clear, we replace the findings block with a single
     reassuring confirmation paragraph. */
  const findingsSection = findings.length === 0
    ? `
      <tr>
        <td class="px-mobile" style="padding:20px 32px 8px 32px;">
          <p class="text-ink" style="margin:0;font-family:${tokens.fontFamily};font-size:15px;line-height:1.55;color:${tokens.ink};">
            All integrity and outbound-routing checks passed against current thresholds. Catalog is healthy.
          </p>
        </td>
      </tr>`
    : `
      <tr>
        <td class="px-mobile" style="padding:24px 32px 8px 32px;">
          <h2 class="h2-mobile text-ink" style="margin:0;font-family:${tokens.fontFamily};font-size:18px;font-weight:700;color:${tokens.ink};letter-spacing:-0.015em;">
            Findings
          </h2>
        </td>
      </tr>
      <tr><td style="font-size:0;line-height:0;height:10px;">&nbsp;</td></tr>
      ${findings.map(findingCard).join("")}`;

  const footnote = `
    <tr>
      <td class="px-mobile" style="padding:20px 32px 8px 32px;">
        <p class="text-ink-3" style="margin:0;font-family:${tokens.fontFamily};font-size:12px;line-height:1.55;color:${tokens.ink3};">
          Re-run any time: <code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:11.5px;color:${tokens.ink2};" class="text-ink-2">npm run health-check</code>. Thresholds + rationale live in <code style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:11.5px;color:${tokens.ink2};" class="text-ink-2">scripts/health-check.ts</code>.
        </p>
      </td>
    </tr>`;

  const body =
    statusPill +
    heading +
    meta +
    metrics +
    landingMetrics +
    spacer(8) +
    findingsSection +
    spacer(8) +
    footnote;

  return shellMarketing({
    preheader: findings.length === 0
      ? `All integrity and outbound-routing checks passed. ${baseline.totalProducts.toLocaleString()} products, ${baseline.inStockOffers.toLocaleString()} in-stock offers.`
      : `${findings.length} finding${findings.length === 1 ? "" : "s"} in this week's health check — ${findings.filter((f) => f.severity === "ERROR").length} error, ${findings.filter((f) => f.severity === "WARN").length} warn.`,
    body,
  });
}

function buildEmailText(baseline: Baseline, findings: Finding[]): string {
  const lines: string[] = [];
  lines.push("Havlo data health check");
  lines.push(`Run at ${new Date().toUTCString()}`);
  lines.push("");
  lines.push(`Baseline:`);
  lines.push(`  products:    ${baseline.totalProducts.toLocaleString()}`);
  lines.push(`  offers:      ${baseline.totalOffers.toLocaleString()}`);
  lines.push(`  in-stock:    ${baseline.inStockOffers.toLocaleString()}`);
  lines.push(`  stores:      ${baseline.totalStores.toLocaleString()}`);
  lines.push("");
  const landTotal = baseline.inStockOffers || 1;
  const landPct = (n: number) => `${((n / landTotal) * 100).toFixed(1)}%`;
  lines.push(`Where in-stock clicks land:`);
  lines.push(`  product page:       ${baseline.landing.pdp.toLocaleString()}\t${landPct(baseline.landing.pdp)}`);
  lines.push(`  search results:     ${baseline.landing.search.toLocaleString()}\t${landPct(baseline.landing.search)}`);
  lines.push(`  merchant homepage:  ${baseline.landing.home.toLocaleString()}\t${landPct(baseline.landing.home)}`);
  lines.push(`  bounce to /compare: ${baseline.landing.bounce.toLocaleString()}\t${landPct(baseline.landing.bounce)}`);
  lines.push("");
  if (findings.length === 0) {
    lines.push("✓ All checks passed against current thresholds.");
  } else {
    lines.push(`Findings (${findings.length}):`);
    for (const f of findings) {
      lines.push("");
      lines.push(`[${f.severity}] ${f.id}: ${f.headline}`);
      lines.push(`  measured: ${f.value.toLocaleString()}${f.threshold !== undefined ? `  threshold: ${f.threshold.toLocaleString()}` : ""}`);
      if (f.detail) lines.push(`  ${f.detail}`);
    }
  }
  return lines.join("\n");
}

/* escapeHtml is now imported as `esc` from the email layout module
   so the alert template shares the same escaper the newsletter +
   waitlist + notify templates use. Local copy retired. */

/* ── Main ───────────────────────────────────────────────────────── */

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("✗ Supabase admin not configured");
    process.exit(2);
  }

  console.log("▶ Running health checks against production DB...");
  const { baseline, findings } = await runChecks(supa);

  console.log("");
  console.log(buildEmailText(baseline, findings));
  console.log("");

  const shouldEmail = findings.length > 0 || ALWAYS_EMAIL;
  if (DRY_RUN) {
    console.log(`● dry run — would ${shouldEmail ? `email ${RECIPIENT || "(no recipient set)"}` : "skip email (no findings)"}`);
  } else if (shouldEmail) {
    if (!RECIPIENT) {
      console.warn(`✗ Findings present but HEALTH_CHECK_RECIPIENT not set — skipping email. Set the env var to enable alerts.`);
    } else {
      const result = await sendEmail({
        to:       RECIPIENT,
        subject:  buildSubject(findings),
        text:     buildEmailText(baseline, findings),
        html:     buildEmailHtml(baseline, findings),
        tags:     [{ name: "category", value: "health-check" }],
      });
      if (result.ok) console.log(`✓ Alert email sent to ${RECIPIENT} (id=${result.id ?? "?"})`);
      else           console.warn(`✗ Email send failed: ${result.error}`);
    }
  } else {
    console.log("✓ All clean — no email sent. Pass --always-email to test the wire.");
  }

  /* Exit code reflects severity so the GH Actions UI flags failed runs.
     Non-zero exit + a failure-notification configured at repo level
     gives the operator the "this needs attention" signal even outside
     the email channel. */
  if (findings.some((f) => f.severity === "ERROR")) process.exit(1);
  if (findings.some((f) => f.severity === "WARN"))  process.exit(1);
  process.exit(0);
}

main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(2); });
