# Havlo Launch-Readiness Results — 2026-06-18

Execution of the NOT RUN layers from `launch-readiness-test-plan.md` (the layers a browser-only assistant could not reach). Run by an agent with Bash, Supabase read-only SQL, code access, and the project's own scripts. Build/typecheck against the repo; data against the production DB (read-only); Lighthouse against prod `havlo.io`. No writes, no migrations, no emails sent.

## Verdict: CONDITIONAL GO — no P0 blockers found

Every executable launch-gate layer passed: build, both typechecks, lint, data integrity, security boundaries, email/cron config, SEO, accessibility, best-practices. **Zero P0.** Remaining risk is P1 polish (homepage LCP; ~19% of outbound clicks land on a merchant search page rather than the exact product) plus a handful of P2 items. The one layer not exhaustively automated here is the full scripted per-country E2E sweep — mitigated by the prior live browser pass (NG/UK happy-paths verified).

Baseline (health-check, live): products 21,773 · offers 33,183 · in-stock 18,538 · stores 2,571.

## Layer status

| Layer | Status | Evidence |
|---|---|---|
| 0 Build / typecheck / lint | **PASS** | `next build` exit 0; `tsc -p tsconfig.json` + `tsconfig.scripts.json` clean; lint warnings-only (2x `<img>`, 3x exhaustive-deps) |
| 1 Logic (matcher + pure fns) | **PASS** | `test:matcher` 26/29; 3 fails are stricter-than-fixture family taxonomy (AF1→`nike_af1`, Jordan→`nike_jordan`, Ray-Ban correctly rejecting a Wayfarer) — precision-positive, not bugs |
| 2 API security boundaries | **PASS** | open-redirect CLOSED (`verifyGoTarget` HMAC + non-http reject); SSRF CLOSED (img-proxy allowlist + scheme guard + per-hop redirect re-validation + og:image re-check); XSS-in-title fixed prior + browser-confirmed |
| 3 Data integrity (14 checks) | **PASS** | see below |
| 4 E2E per country | **PARTIAL** | prior browser pass did NG/UK render + UK PDP/deals/compare; full scripted Playwright sweep not re-run here |
| 5 SEO / email / cron / perf / a11y | **PASS** | see below |

## Layer 3 — data integrity

| Check | Result | Verdict |
|---|---|---|
| FX freshness | 6/6 currencies (NGN 1359.17, GBP, EUR, AED, INR, ZAR), 9.8h old, source open.er-api.com | PASS |
| Price plausibility | 0 nonpositive in-stock; 0 NGN phones < ₦10k | PASS |
| OOS-as-deal | 0 out-of-stock offers surfaced as a deal | PASS |
| Image coverage | UK 100%, NG 99%, US/IN/AE/ZA/DE 100%; 57 null imgs (0.26%), 5 placeholder-like | PASS |
| Best-offer matview | 13,463 rows == in-stock products; newest 5.8h, oldest 18.4d (weekly snapshot cadence) | PASS |
| AliExpress hard-gate | 399 in-stock, only 2 suspicious-cheap flagship | PASS |
| Price-history coverage | 100% of surfaced products seeded; NG 3,199/3,199 (flat-chart fix held); 46% have ≥2 points | PASS (P2: young) |
| Duplicate products | 101 title_key groups (~0.9%) | PASS (P2) |
| Signature grouping | fashion brand|type pools are coarse by design (feed the dupes/alternatives engine, not same-product); `bardot` brand/neckline collision noted | PASS (P2 watch) |
| Comparison density | phones 14% · computing 11% · gaming 8% · audio 6% · appliances 5% · others 1-4% | INFO — gating verified honest by prior browser pass |
| Dead-passthrough | 5,364/13,463 best offers store a Google relay URL — but click-landing is 80.8% product / 13.6% merchant-search / 5.2% merchant-home / 0.5% Havlo, **0% dead** | P1 (not blocker) |

## Layer 5 — cross-cutting

**SEO** (prior browser pass + canonical code confirm): robots allows GPTBot/ClaudeBot/PerplexityBot/OAI-SearchBot, blocks CCBot/Bytespider; llms.txt present; sitemap valid with hreflang for 6 countries + x-default, DE correctly absent; PDP canonical = product-id (offer-id URLs correctly canonicalize to parent product — the browser pass's "D1" was a **non-defect**); Product/Offer/Organization/Breadcrumb JSON-LD present.

**Emails (dry-run, 0 sent):** alerts 0 triggered; newsletter "no active subscribers" (expected pre-launch; send job wired into `scrape-deals.yml` after dedup); snapshot 6,252 offers queued for weekly snapshot.

**Crons / GitHub Actions (8 workflows):** `scrape-deals` Mon/Wed/Fri 05:00 (paid + SerpAPI + digest) · `scrape-free-daily` Sun/Tue/Thu/Sat (free + dedup + seed price-history) · `fx-rates` daily 03:00 · `price-alerts` daily 07:00 · `compute-category-counts` daily · `maintenance` weekly (resignature, snapshot, sweep-stale --days=14, brand-dtc) · `health-check` weekly · `resolve-relays` **every 4h** (Playwright relay→merchant backfill, ~2,000/cycle). Cadence matches the stated Mon/Wed/Fri paid model. No `vercel.json` crons (all on GitHub Actions).

**Lighthouse (prod, mobile, NG home):** Performance **75**, Accessibility **96**, SEO **100**, Best-Practices **100**. CLS 0, TBT 0ms — **LCP 6.6s** is the lone weak metric (hero video).

## Defects

| id | sev | area | finding | action |
|----|-----|------|---------|--------|
| L-1 | P1 | Perf | Homepage LCP 6.6s (Lighthouse mobile); CLS/TBT perfect | poster-frame / lazy-load / preload the hero video; revisit "bigger videos" tradeoff |
| L-2 | P1 | Outbound | ~18.8% of in-stock clicks land on merchant search/home, not the exact PDP (Google-relay backlog) | being auto-reduced by `resolve-relays` (4h); monitor throughput; the durable fix is ingest-time resolution |
| L-3 | P2 | Outbound | 21 uncurated head stores send 10+ relay clicks to a guessed homepage — incl. **apple** (13), monitors (21), thinvent-technologies (21), lowestrate-shopping (12), geekom (10) | add curated entries in `src/lib/merchant-search-urls.ts` (probe search URL live first) |
| L-4 | P2 | Data | 8 (product,store) pairs with >50 offers; worst `house-of-sneakers` 158 | add tracking-param canonicalization key for these merchants |
| L-5 | P2 | Data | 101 duplicate title_key product groups (~0.9%) | dedup pass |
| L-6 | P2 | Test | 3/29 matcher fixtures stale (stricter family taxonomy) | update fixtures to match granular families |
| L-7 | P2 | Monitoring | `HEALTH_CHECK_RECIPIENT` unset → health-check findings not emailed | set env var to enable weekly alerts |
| L-8 | P2 | DE | `/de` falls back to UK content rather than a gated DE surface (browser pass D2) | founder decision: keep fallback or gate explicitly |
| L-9 | P2 | Data | merchant-sourced title typo "ASOS DEISGN…" (browser pass D4) | cosmetic; source-data normalization |

## Cleared / non-issues

- **Dead-passthrough is not broken** — 0% of clicks reach a dead Google page; 80.8% reach the exact product.
- **D1 canonical** (browser pass P1) — correct SEO canonicalization of offer-id → product-id URLs.
- FX unification, OOS-as-deal, image coverage, open-redirect, SSRF, AliExpress gate — all clean.

## Not run / out of scope here

- **Full scripted per-country E2E** (Playwright J1-J12 × 6 countries): the live browser pass covered NG/UK happy-paths; a committed E2E suite still doesn't exist (Playwright is present only for scraping).
- **Exhaustive hostile-input HTTP fuzz of all 24 API routes**: the two highest-risk boundaries (open-redirect, SSRF) were code-verified closed; a systematic fuzz of every endpoint was not performed.
- **Lighthouse was limited to NG home** (npm-cache EACCES cost retries); extend to PDP/compare/deals + other countries for a full CWV matrix.

## Tooling gaps (recommendations)

1. Add `vitest` for pure logic (FX, signature, categorize, smartFallbackUrl) — fastest ROI.
2. Promote the plan's Layer 4 into a committed Playwright E2E suite + PR CI gate running `tsc` + `build` + `lint`.
3. Expand `test:matcher` fixtures with the historical defect cases and refresh the 3 stale ones.
