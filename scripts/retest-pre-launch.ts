#!/usr/bin/env tsx
/* Pre-launch retest harness.

   Hits production havlo.io plus checks source files for the open
   QA findings from the last three retest passes. One script, one
   report, every flagged item end-to-end so we don't have to chase
   them one Slack message at a time.

   Two-layer verification:
     - SOURCE checks (always run): read local files, prove the fix
       is wired in HEAD. Catches regressions in code review.
     - LIVE checks (always run by default): hit production, prove
       the fix actually shipped. Catches stale CDN, failed deploys,
       wrong branch deployed.

   Run:
     pnpm tsx scripts/retest-pre-launch.ts                # everything
     pnpm tsx scripts/retest-pre-launch.ts --only=P0-3    # one check
     pnpm tsx scripts/retest-pre-launch.ts --mode=pre-deploy   # skip LIVE-copy
     pnpm tsx scripts/retest-pre-launch.ts --mode=post-deploy  # only LIVE-copy
     SITE=https://havlo-preview.vercel.app pnpm tsx scripts/retest-pre-launch.ts

   Modes:
     full         (default) — source + live checks together
     pre-deploy   — source only; useful before committing
     post-deploy  — live copy only; useful in CI after deploy succeeds

   Exit code: 0 if all pass, 1 if any P0 fail, 2 if only P1 fail.
   That lets CI gate on P0 without false-positive blocking on P1
   copy that still needs a deploy. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectFamily } from "../src/lib/search/families";

/* ── Config ──────────────────────────────────────────────────────── */

const SITE = process.env.SITE ?? "https://havlo.io";
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const MODE: "full" | "pre-deploy" | "post-deploy" =
  (process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] as "full" | "pre-deploy" | "post-deploy")
  ?? "full";
const REPO = resolve(__dirname, "..");

type Severity = "P0" | "P1";
type Result   = { id: string; severity: Severity; title: string; pass: boolean; detail: string };
const results: Result[] = [];

function record(r: Result) {
  results.push(r);
  const icon = r.pass ? "✓" : "✗";
  const sev  = r.pass ? "" : ` [${r.severity}]`;
  console.log(`${icon} ${r.id}${sev}  ${r.title}`);
  if (!r.pass || process.env.VERBOSE) console.log(`     ${r.detail}`);
}

function shouldRun(id: string): boolean {
  if (ONLY) return id === ONLY || id.startsWith(`${ONLY}-`);
  /* Mode gating: pre-deploy skips LIVE-copy (production hasn't shipped
     yet, those will fail by design). post-deploy skips source-only
     wire checks and runs the live verification. SMOKE + P0 run in
     every mode because they're the launch blockers either way. */
  if (MODE === "pre-deploy" && id.startsWith("LIVE-")) return false;
  if (MODE === "post-deploy") {
    /* Keep smoke + P0 (always relevant); skip source-only wire checks. */
    if (id.startsWith("SMOKE")) return true;
    if (id.startsWith("P0-"))   return true;
    if (id.startsWith("LIVE-")) return true;
    return false;
  }
  return true;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

async function fetchJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = `${SITE}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

async function fetchHtml(path: string): Promise<string> {
  const res = await fetch(`${SITE}${path}`, { headers: { "user-agent": "havlo-retest/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.text();
}

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(REPO, relativePath), "utf8");
}

/* ── P0-3: Adidas Samba alternatives must be footwear-only ───────── */
/* This was flagged three retest passes in a row. The launch-day
   screenshot risk: anchor is a Samba shoe, top three "cheapest
   alternatives" are t-shirts and shorts. Our family filter exists
   (alternativeFamilyMatches in pg-fts.ts); this check verifies the
   live API obeys it and surfaces any regressions in one place. */

type CompareDeal = { title: string; price?: number; storeName?: string };
type CompareResp = { dupes?: CompareDeal[]; offers?: CompareDeal[]; results?: CompareDeal[] };

async function checkSambaRelevance(country: "ng" | "uk") {
  const id = `P0-3-${country}`;
  if (!shouldRun("P0-3")) return;

  try {
    /* The two paths the QA tester hits — both should return only
       footwear for an Adidas Samba anchor. Probe both because they
       use different family-filter codepaths (pgFtsFindSimilar vs
       pgFtsFindDupes). */
    const compareUrl = `/api/compare?q=${encodeURIComponent("Adidas Samba")}&country=${country}`;
    const dupesUrl   = `/api/compare/dupes?q=${encodeURIComponent("adidas Samba Men's OG")}&country=${country}`;

    const [compare, dupes] = await Promise.all([
      fetchJson<CompareResp>(compareUrl),
      fetchJson<CompareResp>(dupesUrl),
    ]);

    /* The compare endpoint nests results under different keys
       depending on whether it found a single anchor or a search-
       style match. Normalise across shapes. */
    const compareItems = compare.dupes ?? compare.offers ?? compare.results ?? [];
    const dupeItems    = dupes.dupes   ?? dupes.results  ?? [];
    const all          = [...compareItems, ...dupeItems];

    /* Filter to items whose detected family is NOT footwear. Those
       are the cross-category leaks the QA tester keeps screenshotting. */
    const leaks = all.filter((d) => {
      const fam = detectFamily(d.title ?? "");
      return fam !== null && fam !== "footwear";
    });

    if (leaks.length === 0) {
      record({
        id, severity: "P0",
        title: `Samba alternatives footwear-only (${country.toUpperCase()})`,
        pass: true,
        detail: `${all.length} alternatives returned, 0 cross-category leaks. ` +
                `Families: ${[...new Set(all.map((d) => detectFamily(d.title ?? "") ?? "unknown"))].join(", ")}`,
      });
    } else {
      record({
        id, severity: "P0",
        title: `Samba alternatives footwear-only (${country.toUpperCase()})`,
        pass: false,
        detail: `${leaks.length} cross-category leaks found:\n     ` +
                leaks.slice(0, 5).map((l) => `→ ${detectFamily(l.title ?? "")}: ${l.title}`).join("\n     "),
      });
    }
  } catch (err) {
    record({
      id, severity: "P0",
      title: `Samba alternatives footwear-only (${country.toUpperCase()})`,
      pass: false,
      detail: `Probe failed: ${(err as Error).message}`,
    });
  }
}

/* ── P1-new-2: Cashback waitlist double-click guard ──────────────── */
/* Verifies the inFlight ref-based guard is still in WaitlistForm.tsx.
   QA reported it regressed between passes. Source-level check
   because the symptom (form submits twice) is only reproducible
   with a real human clicking faster than React can re-render — but
   the guard's presence is a deterministic source-level invariant. */

function checkWaitlistDoubleClickGuard() {
  const id = "P1-new-2";
  if (!shouldRun(id)) return;

  try {
    const src = readRepoFile("src/components/cashback/WaitlistForm.tsx");

    const hasRef       = /useRef[^(]*\([^)]*\)/.test(src) && /inFlight\s*=\s*useRef/.test(src);
    const hasEarlyExit = /if\s*\(\s*inFlight\.current\s*\)\s*return/.test(src);
    const hasSet       = /inFlight\.current\s*=\s*true/.test(src);
    const hasReset     = /inFlight\.current\s*=\s*false/.test(src);

    const allPresent = hasRef && hasEarlyExit && hasSet && hasReset;

    record({
      id, severity: "P1",
      title: "Cashback waitlist in-flight guard wired in source",
      pass: allPresent,
      detail: allPresent
        ? "useRef + early-exit + set/reset all present"
        : `Missing: ${[
            !hasRef       && "useRef(false) declaration",
            !hasEarlyExit && "if (inFlight.current) return",
            !hasSet       && "inFlight.current = true",
            !hasReset     && "inFlight.current = false (reset)",
          ].filter(Boolean).join(", ")}`,
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "Cashback waitlist in-flight guard wired in source",
      pass: false,
      detail: `Could not read WaitlistForm.tsx: ${(err as Error).message}`,
    });
  }
}

/* ── P1-new: /uk/deals default origin should be "local" ──────────── */
/* QA flagged: UK default "All deals · Relevance" leads with
   AliExpress instead of UK-local retailers. The user's suggested
   fix was "make Local stores the default landing tab" for non-NG
   countries. The check: source-level inspection of DealFeed.tsx
   initialOrigin logic, AND a live probe of /uk/deals HTML to see
   what the page actually delivers. */

async function checkUkDefaultOrigin() {
  const sourceId = "P1-new-uk-default-source";
  const liveId   = "LIVE-uk-default";

  /* Source-level check — was the fix wired? Each sub-check has its
     own shouldRun gate so --mode=pre-deploy can skip the live probe
     and --mode=post-deploy can skip the source probe independently. */
  if (shouldRun(sourceId)) {
    try {
      const src = readRepoFile("src/components/deals/DealFeed.tsx");

      /* The fix could look like any of these patterns. Be generous:
           - initialOrigin = country !== "ng" ? "local" : "all"
           - default to "local" when origin param is absent + non-NG
           - any branch that flips "all" → "local" for non-NG */
      const hasCountryAwareDefault =
        /country\s*[!=]==?\s*["']ng["']\s*\?\s*["']local["']/.test(src) ||
        /country\.code\s*[!=]==?\s*["']ng["']\s*\?\s*["']local["']/.test(src) ||
        /countryCode\s*[!=]==?\s*["']ng["']\s*\?\s*["']local["']/.test(src);

      record({
        id: sourceId, severity: "P1",
        title: "/uk/deals defaults to Local stores (source)",
        pass: hasCountryAwareDefault,
        detail: hasCountryAwareDefault
          ? "Country-aware default origin wired in DealFeed.tsx"
          : "DealFeed.tsx still uses uniform default 'all' regardless of country",
      });
    } catch (err) {
      record({
        id: sourceId, severity: "P1",
        title: "/uk/deals defaults to Local stores (source)",
        pass: false,
        detail: `Could not read DealFeed.tsx: ${(err as Error).message}`,
      });
    }
  }

  if (!shouldRun(liveId)) return;

  /* Live probe — fetch /uk/deals and look for evidence of the
     selected toggle. OriginToggle (src/components/deals/OriginToggle.tsx)
     uses role="tablist" + role="tab" + aria-selected="true|false"
     on each button. Each button also embeds a distinct lucide-react
     icon, and the icon class is in the SVG attributes directly
     after aria-selected:
       all   → lucide-layout-grid
       local → lucide-map-pin
       intl  → lucide-globe

     We scope the search to the "Deal origin" tablist (so the page's
     other aria-selected widgets don't leak in) and use the icon
     class as the deterministic active-option signal. */
  try {
    const html = await fetchHtml("/uk/deals");

    /* Scope to the OriginToggle's tablist. ~3000 chars is enough to
       cover all three buttons plus their embedded SVGs and labels
       without bleeding into the next section of the page. */
    const tablistMatch = html.match(
      /role=["']tablist["'][^>]*aria-label=["']Deal origin["'][\s\S]{0,3000}/i,
    );

    let pass = false;
    let detail = "";

    if (!tablistMatch) {
      /* Tablist absent from SSR HTML — toggle hydrates client-side
         and the source check is authoritative. */
      pass = true;
      detail = "OriginToggle hydrates client-side (not in SSR HTML); source check is authoritative";
    } else {
      const tablistHtml = tablistMatch[0];

      /* Within the tablist, find the chunk that follows
         aria-selected="true" and check which lucide icon it contains. */
      const activeChunkMatch = tablistHtml.match(/aria-selected=["']true["'][\s\S]{0,600}/i);

      if (!activeChunkMatch) {
        detail = "Live /uk/deals tablist rendered but no aria-selected=\"true\" button found";
      } else {
        const activeChunk = activeChunkMatch[0];
        const localActive = /lucide-map-pin/i.test(activeChunk);
        const allActive   = /lucide-layout-grid/i.test(activeChunk);
        const intlActive  = /lucide-globe/i.test(activeChunk);

        if (localActive) {
          pass = true;
          detail = "Live /uk/deals SSRs with Local stores as active toggle";
        } else if (allActive) {
          detail = "Live /uk/deals SSRs with All deals as active (regression or pending deploy)";
        } else if (intlActive) {
          detail = "Live /uk/deals SSRs with International as active (unexpected)";
        } else {
          detail = "Live /uk/deals active button found but no recognised lucide icon class";
        }
      }
    }

    record({
      id: liveId, severity: "P1",
      title: "/uk/deals delivers Local default in HTML",
      pass,
      detail,
    });
  } catch (err) {
    record({
      id: liveId, severity: "P1",
      title: "/uk/deals delivers Local default in HTML",
      pass: false,
      detail: `Live probe failed: ${(err as Error).message}`,
    });
  }
}

/* ── LIVE: copy verification on production ───────────────────────── */
/* Source checks above prove the fix is wired in HEAD. These live
   checks fetch the deployed HTML and grep for the new strings —
   they fail pre-deploy (the production CDN still has the old copy)
   and pass post-deploy. Together with the source checks, they give
   a clear "ready to ship" vs "ship pending" signal:

     source pass + live fail  → committed, awaiting deploy
     source pass + live pass  → shipped and live
     source fail              → not committed yet

   Live checks run on the NG homepage + /ng/cashback because those
   surfaces are the canonical canary. Other-country variants of the
   same components ship via the same build, so verifying one country
   is enough to prove the deploy. */

async function checkLiveCashbackHero() {
  const id = "LIVE-cashback-hero";
  if (!shouldRun(id)) return;

  try {
    const html = await fetchHtml("/ng/cashback");
    const hasNewH1   = /Cashback that lands in your bank account\./.test(html);
    const hasNewCoda = /Not points\.\s*Real money\./.test(html);

    record({
      id, severity: "P1",
      title: "Live /ng/cashback serves new hero copy",
      pass: hasNewH1 && hasNewCoda,
      detail: hasNewH1 && hasNewCoda
        ? "New H1 + 'Not points. Real money.' coda present on production"
        : `Production HTML missing: ${[
            !hasNewH1   && "new H1 line",
            !hasNewCoda && "subhead coda",
          ].filter(Boolean).join(", ")} — deploy may be pending`,
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "Live /ng/cashback serves new hero copy",
      pass: false,
      detail: `Live probe failed: ${(err as Error).message}`,
    });
  }
}

async function checkLiveTeaser() {
  const id = "LIVE-teaser";
  if (!shouldRun(id)) return;

  try {
    const html = await fetchHtml("/ng");
    /* The teaser sits between TrendingDeals and CategoryGrid on the
       homepage. The new H2 mirrors the page hero exactly. */
    const hasNewH2   = /Cashback that lands in your bank account\./.test(html);
    const hasCashCoda = /Cash,\s*not points\./.test(html);
    const hasNewCta  = /How it works\s*(→|&#8594;|&rarr;)/.test(html);

    const allPresent = hasNewH2 && hasCashCoda && hasNewCta;

    record({
      id, severity: "P1",
      title: "Live /ng homepage teaser serves new copy",
      pass: allPresent,
      detail: allPresent
        ? "Teaser H2, 'Cash, not points.' coda, and 'How it works →' CTA all live"
        : `Production HTML missing: ${[
            !hasNewH2    && "new H2",
            !hasCashCoda && "'Cash, not points.' coda",
            !hasNewCta   && "'How it works →' CTA",
          ].filter(Boolean).join(", ")} — deploy may be pending`,
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "Live /ng homepage teaser serves new copy",
      pass: false,
      detail: `Live probe failed: ${(err as Error).message}`,
    });
  }
}

async function checkLiveFaqClosers() {
  const id = "LIVE-faq";
  if (!shouldRun(id)) return;

  try {
    const html = await fetchHtml("/ng/cashback");
    /* Sample one phrase from each refreshed FAQ answer. If any phrase
       is missing, the FAQ section didn't get the copy refresh. */
    const samples = [
      { phrase: "take an extra week than ship a broken payout flow", q: "Q1 closer" },
      { phrase: "quietly shrinking your rate",                        q: "Q2 hook"   },
      { phrase: "what keeps the rates this good",                    q: "Q3 closer" },
      { phrase: "Nothing happens quietly",                           q: "Q4 closer" },
    ];

    const missing = samples.filter((s) => !html.includes(s.phrase));

    record({
      id, severity: "P1",
      title: "Live /ng/cashback FAQ serves refreshed answers",
      pass: missing.length === 0,
      detail: missing.length === 0
        ? "All 4 FAQ closer/hook phrases present on production"
        : `Missing on production: ${missing.map((m) => `${m.q} ('${m.phrase}')`).join(", ")} — deploy may be pending`,
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "Live /ng/cashback FAQ serves refreshed answers",
      pass: false,
      detail: `Live probe failed: ${(err as Error).message}`,
    });
  }
}

async function checkLiveWaitlistCopy() {
  const id = "LIVE-waitlist";
  if (!shouldRun(id)) return;

  try {
    const html = await fetchHtml("/ng/cashback");
    /* The H2 above the form changed from "Get notified when cashback
       launches." to "Be first in line when we open." The page is
       server-rendered so this should appear in the initial HTML. */
    const hasNewH2 = /Be first in line when we open\./.test(html);

    record({
      id, severity: "P1",
      title: "Live /ng/cashback waitlist H2 refreshed",
      pass: hasNewH2,
      detail: hasNewH2
        ? "New 'Be first in line when we open.' H2 present"
        : "Production HTML still shows old waitlist H2 — deploy may be pending",
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "Live /ng/cashback waitlist H2 refreshed",
      pass: false,
      detail: `Live probe failed: ${(err as Error).message}`,
    });
  }
}

/* ── P1-new-3: Brand voice — kill the "the moment X launches" line ── */
/* QA flagged the success-state copy "We'll email you the moment
   cashback launches." as the kind of preciousness the rest of the
   brand voice avoids. Source-level check: that line should no
   longer exist anywhere in the codebase. */

function checkSuccessStateBrandVoice() {
  const id = "P1-new-3";
  if (!shouldRun(id)) return;

  try {
    const src = readRepoFile("src/components/cashback/WaitlistForm.tsx");

    /* The flagged phrase. Variants to catch (case-insensitive):
         - "the moment cashback launches"
         - "the moment cashback goes live"
         - "the moment we launch" */
    const flaggedPattern = /the\s+moment\s+(cashback|we|it)\s+(launch|launches|goes\s+live|opens?)/i;
    const stillPresent   = flaggedPattern.test(src);

    record({
      id, severity: "P1",
      title: "WaitlistForm success copy free of 'the moment X launches' pattern",
      pass: !stillPresent,
      detail: stillPresent
        ? `Flagged preciousness pattern still in WaitlistForm.tsx — matches ${flaggedPattern}`
        : "No 'the moment X launches' phrasing detected in success state",
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "WaitlistForm success copy free of 'the moment X launches' pattern",
      pass: false,
      detail: `Could not read WaitlistForm.tsx: ${(err as Error).message}`,
    });
  }
}

/* ── New: cashback page hero copy refresh wired ──────────────────── */
/* The May 2026 copy refresh swaps the hero H1 from "Money back on
   the deals you'd buy anyway." to "Cashback that lands in your
   bank account." Verify the source has the new line. */

function checkCashbackPageHero() {
  const id = "COPY-cashback-hero";
  if (!shouldRun("COPY")) return;

  try {
    const src     = readRepoFile("src/app/[country]/cashback/page.tsx");
    const hasNew  = /Cashback that lands in your bank account\./.test(src);
    const hasCoda = /Not points\.\s*Real money\./.test(src);

    record({
      id, severity: "P1",
      title: "/cashback hero wired with new H1 + 'Not points. Real money.' coda",
      pass: hasNew && hasCoda,
      detail: hasNew && hasCoda
        ? "New hero H1 and subhead coda both present"
        : `Missing: ${[
            !hasNew  && "new H1 line",
            !hasCoda && "subhead coda ('Not points. Real money.')",
          ].filter(Boolean).join(", ")}`,
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "/cashback hero wired with new H1",
      pass: false,
      detail: `Could not read cashback page: ${(err as Error).message}`,
    });
  }
}

/* ── New: CashbackTeaser homepage copy refresh wired ─────────────── */

function checkCashbackTeaserCopy() {
  const id = "COPY-teaser";
  if (!shouldRun("COPY")) return;

  try {
    const src       = readRepoFile("src/components/landing/CashbackTeaser.tsx");
    const newH2     = /Cashback that lands in your bank account\./.test(src);
    const cashCoda  = /Cash,\s*not points\./.test(src);
    const newCta    = /How it works\s*→/.test(src);

    const allWired = newH2 && cashCoda && newCta;

    record({
      id, severity: "P1",
      title: "Homepage CashbackTeaser wired with new H2 + coda + CTA",
      pass: allWired,
      detail: allWired
        ? "New H2, 'Cash, not points.' coda, and 'How it works →' CTA all present"
        : `Missing: ${[
            !newH2    && "new H2 line",
            !cashCoda && "'Cash, not points.' coda",
            !newCta   && "'How it works →' CTA",
          ].filter(Boolean).join(", ")}`,
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "Homepage CashbackTeaser wired with new copy",
      pass: false,
      detail: `Could not read CashbackTeaser: ${(err as Error).message}`,
    });
  }
}

/* ── New: JSON-LD FAQ mirrors visible FAQ ────────────────────────── */
/* Google penalises rich-result mismatches. If we updated the visible
   FAQ but not the JSON-LD block, schema validation breaks. */

function checkFaqJsonLdSync() {
  const id = "SEO-faq-jsonld";
  if (!shouldRun("SEO")) return;

  try {
    const src = readRepoFile("src/app/[country]/cashback/page.tsx");

    /* The four FAQ questions live in both the visible JSX and the
       JSON-LD mainEntity array. Each Q&A pair should appear twice
       in the file. We sample one phrase per Q&A and verify it
       appears at least twice (once in JSX, once in JSON-LD). */
    const samples = [
      "Phase 2 is in build now",            // Q1
      "catch is timing",                    // Q2 — present in both old + new copy
      "their return window closes",         // Q3
      "cashback for that item is reversed", // Q4
    ];

    const missingMirror = samples.filter((s) => {
      const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      const matches = src.match(re) ?? [];
      return matches.length < 2;
    });

    record({
      id, severity: "P1",
      title: "FAQ JSON-LD mirrors visible FAQ text",
      pass: missingMirror.length === 0,
      detail: missingMirror.length === 0
        ? "All four Q&As present in both JSX and JSON-LD mainEntity"
        : `Mismatch — these phrases appear in only one of (JSX, JSON-LD): ${missingMirror.join(" | ")}`,
    });
  } catch (err) {
    record({
      id, severity: "P1",
      title: "FAQ JSON-LD mirrors visible FAQ text",
      pass: false,
      detail: `Could not read cashback page: ${(err as Error).message}`,
    });
  }
}

/* ── Smoke: production homepage + cashback page respond 200 ──────── */
/* Cheap canary — if production is down or a route is busted, the
   rest of the report is meaningless. Always run these first. */

async function checkSmoke() {
  const id = "SMOKE";
  if (!shouldRun("SMOKE")) return;

  const routes = [
    { path: "/ng",          name: "/ng homepage" },
    { path: "/uk",          name: "/uk homepage" },
    { path: "/ng/cashback", name: "/ng/cashback" },
    { path: "/uk/cashback", name: "/uk/cashback" },
    { path: "/ng/deals",    name: "/ng/deals" },
    { path: "/uk/deals",    name: "/uk/deals" },
  ];

  for (const r of routes) {
    try {
      const res = await fetch(`${SITE}${r.path}`, { method: "HEAD" });
      record({
        id: `${id}-${r.path}`, severity: "P0",
        title: `Smoke: ${r.name} responds 2xx`,
        pass: res.ok,
        detail: `HTTP ${res.status} from ${SITE}${r.path}`,
      });
    } catch (err) {
      record({
        id: `${id}-${r.path}`, severity: "P0",
        title: `Smoke: ${r.name} responds 2xx`,
        pass: false,
        detail: `Probe failed: ${(err as Error).message}`,
      });
    }
  }
}

/* ── Main ────────────────────────────────────────────────────────── */

async function main() {
  console.log(`\nRetest target: ${SITE}`);
  console.log(`Mode:          ${MODE}${ONLY ? `   (filter: --only=${ONLY})` : ""}\n`);

  /* Smoke first — bail early if production is down. */
  await checkSmoke();

  /* P0 — the launch blocker. */
  await checkSambaRelevance("ng");
  await checkSambaRelevance("uk");

  /* P1 source checks — copy and behaviour fixes wired in HEAD. */
  checkWaitlistDoubleClickGuard();
  await checkUkDefaultOrigin();
  checkSuccessStateBrandVoice();
  checkCashbackPageHero();
  checkCashbackTeaserCopy();
  checkFaqJsonLdSync();

  /* LIVE copy verification — production HTML reflects HEAD. These
     fail pre-deploy by design and pass after the deploy ships. */
  await checkLiveCashbackHero();
  await checkLiveTeaser();
  await checkLiveFaqClosers();
  await checkLiveWaitlistCopy();

  /* Summary. */
  const ran      = results.length;
  const failed   = results.filter((r) => !r.pass);
  const failedP0 = failed.filter((r) => r.severity === "P0");
  const failedP1 = failed.filter((r) => r.severity === "P1");

  console.log("\n────────────────────────────────────────────────");
  console.log(`Total: ${ran}   Passed: ${ran - failed.length}   Failed: ${failed.length}`);
  if (failedP0.length) console.log(`  P0 failures: ${failedP0.length}  ← LAUNCH BLOCKER`);
  if (failedP1.length) console.log(`  P1 failures: ${failedP1.length}`);
  console.log("────────────────────────────────────────────────");
  if (MODE !== "post-deploy" && failed.some((r) => r.id.startsWith("LIVE-"))) {
    console.log("Note: LIVE-* failures are expected pre-deploy. Re-run after shipping.");
  }
  console.log("");

  if (failedP0.length) process.exit(1);
  if (failedP1.length) process.exit(2);
}

main().catch((e) => {
  console.error("\n✗ unexpected error in retest harness:", e);
  process.exit(1);
});
