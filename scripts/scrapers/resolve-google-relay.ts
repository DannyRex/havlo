/* Google Shopping relay resolver.
   ─────────────────────────────────────────────────────────────────────
   Takes a Google Shopping relay URL (the kind ingested from SerpAPI
   google_shopping results — host is google.com, query string carries
   a `prds=…productid:X` segment) and returns the actual merchant URL
   the relay points at.

   Why this exists: SerpAPI's google_product endpoint that previously
   resolved relays at click-time was deprecated by Google ("The Google
   Product service is no longer offered by Google" — verified May 2026
   via direct probe). With the click-time resolver dead, every relay=Y
   click falls through to merchant_search (the right merchant's search
   page, not its PDP). PDP-ok dropped from a hypothetical ~70% to 26%.

   The right fix is to resolve relays once at INGEST time and store the
   resolved merchant URL in offers.url. Click-time becomes a pure
   passthrough — instant, no third-party API dependency, no recurring
   cost. This module is the one-time + per-ingest resolution primitive.

   Approach: Playwright + stealth navigates the relay URL. Google
   renders a click-through page with the merchant link visible in the
   DOM. We extract the highest-priority outbound merchant href and
   return it. Falls back to clicking-through-and-following-redirects
   when DOM extraction fails (e.g., Google rotates the page shape).

   Not in scope here:
     - Browser lifecycle (caller provides the Page)
     - Affiliate tag wrapping (happens later via wrapWithAffiliate)
     - Hostname verification against the expected merchant (caller's
       job — the resolver returns the raw merchant URL it found,
       caller decides whether it's the right one)
     - Catalog persistence (caller writes to offers.url) */

import type { Page } from "playwright";

export function isGoogleRelay(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h === "google.com" || h.endsWith(".google.com");
  } catch { return false; }
}

/* Hostnames that look like a merchant link but are actually Google
   ad / tracking redirects. Treat as relays too — we want the REAL
   merchant host underneath. */
const GOOGLE_INTERNAL_HOSTS = new Set<string>([
  "google.com",
  "www.google.com",
  "googleadservices.com",
  "www.googleadservices.com",
  "googlesyndication.com",
  "www.googlesyndication.com",
  "gstatic.com",
  "www.gstatic.com",
  "doubleclick.net",
  "googleusercontent.com",
  "www.googleusercontent.com",
]);

function isGoogleHost(host: string): boolean {
  const h = host.toLowerCase();
  if (GOOGLE_INTERNAL_HOSTS.has(h)) return true;
  if (h.endsWith(".google.com")) return true;
  if (h.endsWith(".googleadservices.com")) return true;
  if (h.endsWith(".googlesyndication.com")) return true;
  if (h.endsWith(".doubleclick.net")) return true;
  return false;
}

export interface ResolveResult {
  /** The final merchant URL we resolved to, or null on failure. */
  url:        string | null;
  /** Which strategy succeeded — useful for telemetry + debugging. */
  strategy:   "dom-extraction" | "click-through" | "failed";
  /** Final HTTP status code seen during navigation (debugging). */
  httpStatus: number | null;
  /** Time taken in ms. */
  elapsedMs:  number;
}

/* Strategy 1: DOM extraction.
   Google Shopping's intermediate page contains the merchant URL as
   an outbound <a href> on the page. Look for the highest-priority
   candidate: the "Visit site" / "Buy" / "Shop now" CTA usually
   carries the cleanest merchant href. Falls back to "first outbound
   non-Google href" when the named CTA isn't present.

   We do NOT click anything in this strategy — pure DOM read. Faster,
   less anti-bot exposure than a real click + redirect chain. */
/* String-form evaluator body. tsx/esbuild rewrites TypeScript
   class-style functions inside page.evaluate(() => {...}) to
   reference helpers like __name / __name2 / __publicField that
   don't exist in the browser context, and Playwright silently
   swallows the ReferenceError as null. Passing the body as a
   string bypasses the bundler entirely — Playwright eval()s the
   exact text we write here.

   Accepts an optional expectedHost via window.__havloExpectedHost
   (we set it before calling) so the extractor can prioritise
   merchant-matching hrefs when we know which merchant to look
   for. Falls back to "first non-Google + non-noise host" when
   the hint is absent or doesn't match anything. */
const EXTRACT_MERCHANT_JS = `
(function() {
  function isNoiseHost(h) {
    // Non-merchant hosts that Google Shopping commonly surfaces
    // alongside the real product (reviews, discussions, social).
    // Adding more here as we observe false-positives in the wild.
    return h === 'reddit.com'   || h.endsWith('.reddit.com')
        || h === 'youtube.com'  || h.endsWith('.youtube.com')
        || h === 'youtu.be'
        || h === 'twitter.com'  || h.endsWith('.twitter.com')
        || h === 'x.com'        || h.endsWith('.x.com')
        || h === 'facebook.com' || h.endsWith('.facebook.com')
        || h === 'instagram.com'|| h.endsWith('.instagram.com')
        || h === 'tiktok.com'   || h.endsWith('.tiktok.com')
        || h === 'pinterest.com'|| h.endsWith('.pinterest.com')
        || h === 'wikipedia.org'|| h.endsWith('.wikipedia.org')
        || h === 'quora.com'    || h.endsWith('.quora.com');
  }
  function isGoogleHost(h) {
    return h === 'google.com'           || h.endsWith('.google.com')
        || h === 'googleadservices.com' || h.endsWith('.googleadservices.com')
        || h === 'googlesyndication.com'|| h.endsWith('.googlesyndication.com')
        || h === 'doubleclick.net'      || h.endsWith('.doubleclick.net')
        || h === 'gstatic.com'          || h.endsWith('.gstatic.com')
        || h === 'googleusercontent.com'|| h.endsWith('.googleusercontent.com');
  }
  function collectHref(a) {
    var href = a && a.href;
    if (!href || typeof href !== 'string' || href.indexOf('http') !== 0) return null;
    try {
      var u = new URL(href);
      var h = u.hostname.toLowerCase();
      if (isGoogleHost(h)) return null;
      if (isNoiseHost(h))  return null;
      return { href: href, host: h };
    } catch (_e) { return null; }
  }
  function matchesExpected(host, expected) {
    if (!expected) return false;
    var hh = host.replace(/^www\\./, '');
    var ex = expected.replace(/^www\\./, '');
    return hh === ex || hh.endsWith('.' + ex) || ex.endsWith('.' + hh);
  }

  var expectedHost = (typeof window !== 'undefined' && window.__havloExpectedHost) || '';
  var allAnchors   = document.querySelectorAll("a, [role='link']");
  var ctaTextRe    = /^(visit site|visit|buy|shop|view|see at|see on|continue|website)/i;

  // Priority 1: anchor whose host matches expectedHost (when set).
  // This handles the "Reddit discussion landed before merchant link"
  // false-positive — if we know we're looking for amazon.de, only
  // surface amazon.de hrefs, not the random Reddit review link
  // Google embeds in the shopping result.
  if (expectedHost) {
    for (var i = 0; i < allAnchors.length; i++) {
      var c1 = collectHref(allAnchors[i]);
      if (c1 && matchesExpected(c1.host, expectedHost)) return c1.href;
    }
  }

  // Priority 2: CTA-text-matched anchors (visit site / buy / etc.).
  for (var k = 0; k < allAnchors.length; k++) {
    var a = allAnchors[k];
    var text = ((a.textContent || '') + '').trim();
    if (!ctaTextRe.test(text)) continue;
    var c2 = collectHref(a);
    if (c2) return c2.href;
  }

  // Priority 3: first outbound non-Google non-noise anchor.
  for (var j = 0; j < allAnchors.length; j++) {
    var c3 = collectHref(allAnchors[j]);
    if (c3) return c3.href;
  }

  return null;
})()
`;

async function extractMerchantUrlFromDom(page: Page, expectedHost?: string): Promise<string | null> {
  /* String-form evaluate — sidesteps esbuild's TypeScript helper
     injection that was silently failing in the browser context.
     Stash expectedHost on `window` so the string-form extractor
     can read it without us templating-into the JS string (which
     would risk injection if expectedHost ever came from untrusted
     input). */
  if (expectedHost) {
    await page.evaluate(`window.__havloExpectedHost = ${JSON.stringify(expectedHost)};`);
  } else {
    await page.evaluate("window.__havloExpectedHost = '';");
  }
  return await page.evaluate(EXTRACT_MERCHANT_JS) as string | null;
}

/* Strategy 2: click-through fallback.
   When DOM extraction finds nothing usable, simulate a real user
   click on the most likely merchant CTA. The browser handles the
   redirect chain and we read the final URL from page.url() after
   navigation settles.

   Slower than DOM extraction (full redirect chain) and more anti-
   bot exposure (Google sometimes shows interstitials on second-hop
   clicks from headless browsers), so we only reach this when
   strategy 1 fails. */
async function followClickThrough(page: Page): Promise<string | null> {
  /* Look for a link containing "Visit site" or similar — if there
     is one, click it and wait for navigation. */
  const candidates = [
    "a:has-text('Visit site')",
    "a:has-text('Visit')",
    "a:has-text('Buy now')",
    "a:has-text('Shop now')",
    "[role='link']:has-text('Visit')",
  ];
  for (const sel of candidates) {
    try {
      const locator = page.locator(sel).first();
      if (await locator.count() === 0) continue;
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }),
        locator.click({ timeout: 5_000 }),
      ]);
      const finalUrl = page.url();
      if (!isGoogleHost(new URL(finalUrl).hostname)) return finalUrl;
    } catch {/* try next selector */}
  }
  return null;
}

/** Resolve a Google Shopping relay URL to the underlying merchant URL.
    Caller is responsible for the Page lifecycle (open / close / proxy /
    UA configuration). The Page should already have stealth + a
    realistic UA applied so Google doesn't serve a bot-detection
    interstitial.

    @param expectedHost  Optional merchant hostname hint (e.g.
      "argos.co.uk"). When provided, the extractor prioritises hrefs
      whose host matches — fixes the "Reddit review link landed
      before merchant link" false-positive class. Pass undefined for
      a hostname-agnostic resolution. */
export async function resolveGoogleRelay(
  page: Page,
  googleUrl: string,
  expectedHost?: string,
): Promise<ResolveResult> {
  const t0 = Date.now();
  /* Passthrough: not a Google relay → nothing to resolve. */
  if (!isGoogleRelay(googleUrl)) {
    return { url: googleUrl, strategy: "dom-extraction", httpStatus: 200, elapsedMs: Date.now() - t0 };
  }

  let httpStatus: number | null = null;
  try {
    const response = await page.goto(googleUrl, {
      waitUntil: "domcontentloaded",
      timeout:   30_000,
    });
    httpStatus = response?.status() ?? null;
    /* Brief settle — Google sometimes inlines the merchant link via
       client-side script. 800ms is the empirical sweet spot
       (longer = more chance of getting flagged as headless). */
    await page.waitForTimeout(800);

    /* Strategy 1: DOM extraction. */
    const fromDom = await extractMerchantUrlFromDom(page, expectedHost);
    if (fromDom) {
      return { url: fromDom, strategy: "dom-extraction", httpStatus, elapsedMs: Date.now() - t0 };
    }

    /* Strategy 2: click-through fallback. */
    const fromClick = await followClickThrough(page);
    if (fromClick) {
      return { url: fromClick, strategy: "click-through", httpStatus, elapsedMs: Date.now() - t0 };
    }
  } catch (err) {
    /* swallow — return failure shape below */
    void err;
  }

  return { url: null, strategy: "failed", httpStatus, elapsedMs: Date.now() - t0 };
}
