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
  const baseline: Baseline = { totalProducts, totalOffers, inStockOffers, totalStores };

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

function buildEmailHtml(baseline: Baseline, findings: Finding[]): string {
  const tone = findings.length === 0 ? "#10B981" : findings.some((f) => f.severity === "ERROR") ? "#DC2626" : "#F59E0B";
  const findingRows = findings.length === 0
    ? `<tr><td style="padding:16px;color:#10B981;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;">All checks passed against current thresholds.</td></tr>`
    : findings.map((f) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #E2E8F0;vertical-align:top;">
            <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:11px;font-weight:600;color:${f.severity === "ERROR" ? "#DC2626" : "#F59E0B"};text-transform:uppercase;letter-spacing:0.05em;">${f.severity} · ${f.id}</div>
            <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;font-weight:600;color:#0F172A;margin-top:4px;">${escapeHtml(f.headline)}</div>
            <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#475569;margin-top:6px;">measured: <b>${f.value.toLocaleString()}</b>${f.threshold !== undefined ? ` &nbsp;·&nbsp; threshold: ${f.threshold.toLocaleString()}` : ""}</div>
            ${f.detail ? `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:13px;color:#475569;margin-top:6px;line-height:1.5;">${escapeHtml(f.detail)}</div>` : ""}
          </td>
        </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;background:#F7F8FA;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
    <tr>
      <td style="padding:24px;border-bottom:4px solid ${tone};">
        <div style="font-size:11px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.1em;">Havlo data health check</div>
        <div style="font-size:22px;font-weight:700;color:#0F172A;margin-top:4px;">${escapeHtml(buildSubject(findings).replace(/^[⚠✓]\s/, ""))}</div>
        <div style="font-size:13px;color:#475569;margin-top:6px;">${new Date().toUTCString()}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px;background:#F7F8FA;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td width="25%"><div style="font-size:11px;color:#94A3B8;">PRODUCTS</div><div style="font-size:18px;font-weight:700;color:#0F172A;">${baseline.totalProducts.toLocaleString()}</div></td>
            <td width="25%"><div style="font-size:11px;color:#94A3B8;">OFFERS</div><div style="font-size:18px;font-weight:700;color:#0F172A;">${baseline.totalOffers.toLocaleString()}</div></td>
            <td width="25%"><div style="font-size:11px;color:#94A3B8;">IN-STOCK</div><div style="font-size:18px;font-weight:700;color:#0F172A;">${baseline.inStockOffers.toLocaleString()}</div></td>
            <td width="25%"><div style="font-size:11px;color:#94A3B8;">STORES</div><div style="font-size:18px;font-weight:700;color:#0F172A;">${baseline.totalStores.toLocaleString()}</div></td>
          </tr>
        </table>
      </td>
    </tr>
    ${findingRows}
    <tr>
      <td style="padding:16px 24px;background:#F7F8FA;border-top:1px solid #E2E8F0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:11px;color:#94A3B8;">
        Run scripts/health-check.ts manually any time. Adjust thresholds in the same file.
      </td>
    </tr>
  </table>
</body></html>`;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

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
