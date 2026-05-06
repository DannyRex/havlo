/**
 * GET /api/sniff?url=<encoded-url>
 *
 * Server-side page fetcher for the URL Smart Switch feature.
 * Fetches a live product page, extracts title / image / price from meta tags,
 * then normalises the raw title with gpt-4o-mini so we get a clean product
 * name that can be fed straight into vectorFindSimilar.
 *
 * Works with: Jumia, Amazon, Konga, AliExpress, Slot, Kara, any store that
 * sets og:title (which is virtually all e-commerce).
 *
 * Bot-detection fallback: if the fetch is blocked we return ok:false and the
 * compare page falls back to slug-based vector search.
 *
 * Cache: 5 min (CDN) — same URL from different users reuses the cached sniff.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export interface SniffResult {
  ok: boolean;
  url: string;
  store: string;
  rawTitle: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  /** Amazon ASIN if the URL was an Amazon product page. Useful for
      future PAAPI lookups + as a stable identifier in compare flows. */
  asin?: string | null;
  /** Marketplace inferred from hostname (us / uk / de / ae / in).
      Drives the right affiliate tag at click-through time. */
  marketplace?: string | null;
  error?: string;
}

/* Extract Amazon ASIN from a URL pathname.
   Patterns: /dp/ASIN, /gp/product/ASIN, /product/ASIN
   ASINs are exactly 10 alphanumeric chars (uppercase A-Z + digits). */
function extractAsin(url: URL): string | null {
  const m = url.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

/* Amazon's hostname → marketplace code mapping. */
function detectAmazonMarketplace(hostname: string): string | null {
  const h = hostname.replace(/^www\./, "").toLowerCase();
  if (h === "amazon.com")    return "us";
  if (h === "amazon.co.uk")  return "uk";
  if (h === "amazon.de")     return "de";
  if (h === "amazon.ae")     return "ae";
  if (h === "amazon.in")     return "in";
  if (h === "amazon.ca")     return "ca";
  if (h === "amazon.com.au") return "au";
  if (h === "amazon.co.jp")  return "jp";
  return null;
}

/* ASIN-based image URL fallback. Amazon serves canonical product
   images via this pattern for ASINs that have a registered main
   image (most do). The path maps the ASIN → image regardless of
   the marketplace's TLD; the same product image works across US,
   UK, DE, etc. since it's tied to ASIN not country.

   Note: not every ASIN resolves successfully here. The card-render
   onError fallback (in MasonryCard / DupeCard) catches the 0-byte
   placeholder response and swaps to gradient + emoji, so worst
   case is the existing "no image" UX. Best case (most products):
   we get a real product photo. */
function buildAmazonImageFromAsin(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL500_.jpg`;
}

/* ── Store name map ───────────────────────────────────────────────────── */

const STORE_MAP: [string, string][] = [
  ["jumia.com.ng", "Jumia"],
  ["jumia.com", "Jumia"],
  ["konga.com", "Konga"],
  ["amazon.com", "Amazon"],
  ["amazon.co.uk", "Amazon UK"],
  ["amazon.de", "Amazon DE"],
  ["aliexpress.com", "AliExpress"],
  ["slot.ng", "Slot"],
  ["kara.com.ng", "Kara"],
  ["pointek.ng", "Pointek"],
  ["jiji.ng", "Jiji"],
  ["payporte.com", "Payporte"],
  ["noon.com", "Noon"],
  ["myntra.com", "Myntra"],
  ["flipkart.com", "Flipkart"],
];

function detectStore(hostname: string): string {
  const h = hostname.replace(/^www\./, "");
  for (const [domain, name] of STORE_MAP) {
    if (h === domain || h.endsWith("." + domain)) return name;
  }
  const first = h.split(".")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/* ── HTML meta extraction ─────────────────────────────────────────────── */

function extractMeta(html: string, property: string): string | null {
  // Matches both <meta property="og:X" content="…"> and reversed attribute order
  const pats = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"'<>]+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"'<>]+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of pats) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function extractPageTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{3,})<\/title>/i);
  return m ? decodeHtmlEntities(m[1].trim()) : null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function extractPrice(html: string): { price: number | null; currency: string | null } {
  const amount =
    extractMeta(html, "og:price:amount") ??
    extractMeta(html, "product:price:amount") ??
    extractMeta(html, "twitter:data1") ??
    null;
  const currency =
    extractMeta(html, "og:price:currency") ??
    extractMeta(html, "product:price:currency") ??
    null;
  if (amount) {
    const price = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!isNaN(price) && price > 0) return { price, currency };
  }
  return { price: null, currency: null };
}

/* ── Title normalisation ──────────────────────────────────────────────── */

/**
 * Extract a human-readable title from the URL slug when the page itself is
 * blocked. Works well for stores that embed product names in the path, e.g.:
 *   /samsung-galaxy-a06-128gb-blue-356834.html → "Samsung Galaxy A06 128GB Blue"
 *   /dp/B07PXGQC1Q → null (opaque ID — nothing useful)
 */
function extractTitleFromSlug(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);

  // Amazon: /dp/ASIN or /product-name/dp/ASIN — grab the name segment before /dp/
  const dpIdx = segments.indexOf("dp");
  let slug = "";
  if (dpIdx > 0) {
    slug = segments[dpIdx - 1];
  } else {
    slug = segments[segments.length - 1] ?? "";
  }
  slug = slug.replace(/\.[a-z]{2,4}$/, "");

  // Bail on opaque product IDs (all-caps/digits, or looks like a hash)
  if (!slug || /^[A-Z0-9]{6,}$/.test(slug) || slug.length < 8) return null;

  const cleaned = slug
    .replace(/-\d{5,}$/, "")           // Jumia trailing deal ID e.g. -356834
    .replace(/-[a-zA-Z0-9]{15,}$/, "") // Jiji listing hash e.g. -7p6S0VhfxMKI9qFxqhP6BVXX
    .replace(/-/g, " ")
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(\d+)(gb|tb|mb|mp|mah|hz|inch)\b/gi, (_, n, u) => n + u.toUpperCase())
    .trim();

  if (cleaned.split(" ").length < 2) return null;
  return cleaned;
}

/** Regex-only fallback — strips common store prefixes / suffixes. */
function cleanTitleBasic(raw: string): string {
  return raw
    // Amazon.com: prefix
    .replace(/^amazon\.com\s*:\s*/i, "")
    // Trailing store suffixes after | or -
    .replace(
      /\s*[|\-–—]\s*(jumia|konga|amazon|aliexpress|slot|kara|pointek|jiji|payporte|noon|buy online|online shopping|best price|nigeria|ng|official store|shop).*/gi,
      "",
    )
    .replace(/^(buy|shop|order)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: key });
  return _openai;
}

async function normalizeTitle(
  rawTitle: string,
  store: string,
): Promise<{ title: string; brand: string | null }> {
  const basic = cleanTitleBasic(rawTitle);
  const ai = getOpenAI();
  if (!ai) return { title: basic, brand: null };

  try {
    const resp = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 80,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You extract product info from e-commerce page titles. Respond with valid JSON only.",
        },
        {
          role: "user",
          content:
            `Store: ${store}\n` +
            `Raw title: ${rawTitle}\n\n` +
            `Return JSON: { "title": "<clean product name + key specs (storage, color, RAM, screen size, etc.) — no store name, no ads>", "brand": "<brand name or null>" }`,
        },
      ],
    });
    const text = resp.choices[0]?.message?.content?.trim() ?? "";
    const json = text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
    const parsed = JSON.parse(json) as { title?: string; brand?: string | null };
    return {
      title: (parsed.title ?? basic).trim() || basic,
      brand: parsed.brand ?? null,
    };
  } catch {
    return { title: basic, brand: null };
  }
}

/* ── Route handler ────────────────────────────────────────────────────── */

export async function GET(req: NextRequest): Promise<NextResponse> {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";

  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: "url param required" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl);
  } catch {
    return NextResponse.json<SniffResult>(
      { ok: false, url: rawUrl, store: "", rawTitle: "", title: "", brand: null, imageUrl: null, price: null, currency: null, error: "Invalid URL" },
      { status: 400 },
    );
  }

  const store = detectStore(parsedUrl.hostname);

  // Fetch the live page server-side
  let html = "";
  let fetchFailed = false;
  try {
    /* Social-bot User-Agent. Amazon (and most retailers) explicitly
       allow facebookexternalhit / Twitterbot / LinkedInBot to crawl
       product pages so social-media link unfurling works. Generic
       Chrome UAs hit the same anti-bot wall the scraper does and
       return a captcha page or 503. Switching to a social bot UA
       is the difference between getting the og:image / title / price
       extracted vs falling through to the URL-slug-only fallback. */
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Only read the <head> section — saves bandwidth, reduces parse time.
    // Stream and cut off after </head> or 64 KB, whichever comes first.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let chunk = "";
    const MAX_BYTES = 65_536; // 64 KB
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunk += decoder.decode(value, { stream: true });
      total += value.length;
      if (chunk.includes("</head>") || total > MAX_BYTES) {
        reader.cancel();
        break;
      }
    }
    html = chunk;
  } catch {
    fetchFailed = true;
  }

  // If the fetch was blocked (Cloudflare, 403, etc.) fall back to extracting
  // a title from the URL slug — e.g.
  //   jumia.com.ng/samsung-galaxy-a06-128gb-blue-356834.html
  //   → "Samsung Galaxy A06 128GB Blue"
  if (fetchFailed || !html) {
    const slugTitle = extractTitleFromSlug(parsedUrl);
    /* ASIN + marketplace recovery from URL even when the page fetch
       failed. ASIN is the stable identifier; marketplace drives the
       affiliate tag at click time. Build a best-effort image URL
       from the ASIN so the card has SOMETHING to render instead of
       always falling to the gradient. */
    const asin = extractAsin(parsedUrl);
    const marketplace = detectAmazonMarketplace(parsedUrl.hostname);
    const fallbackImage = asin ? buildAmazonImageFromAsin(asin) : null;
    if (slugTitle) {
      const { title, brand } = await normalizeTitle(slugTitle, store);
      return NextResponse.json<SniffResult>(
        { ok: true, url: rawUrl, store, rawTitle: slugTitle, title, brand, imageUrl: fallbackImage, price: null, currency: null, asin, marketplace },
        { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" } },
      );
    }
    /* No usable slug title either — return ok:false but still surface
       any ASIN / marketplace / image we managed to extract from the
       URL. The compare page can still render a basic anchor. */
    return NextResponse.json<SniffResult>(
      {
        ok: !!asin,  // ASIN alone is enough to identify the product
        url: rawUrl,
        store,
        rawTitle: "",
        title: asin ? `Amazon product ${asin}` : "",
        brand: null,
        imageUrl: fallbackImage,
        price: null,
        currency: null,
        asin,
        marketplace,
        error: asin ? undefined : "Page blocked — could not extract product details",
      },
      { headers: { "Cache-Control": asin ? "s-maxage=300, stale-while-revalidate=3600" : "no-store" } },
    );
  }

  // Extract metadata — try multiple meta conventions before falling back to <title>
  const rawTitle =
    extractMeta(html, "og:title") ??
    extractMeta(html, "twitter:title") ??
    extractMeta(html, "title") ??        // Amazon uses <meta name="title">
    extractPageTitle(html) ??
    "";

  /* ASIN + marketplace are extracted from the URL even on success,
     so the response always carries them when present. */
  const asin = extractAsin(parsedUrl);
  const marketplace = detectAmazonMarketplace(parsedUrl.hostname);

  const imageUrl =
    extractMeta(html, "og:image") ??
    extractMeta(html, "twitter:image") ??
    /* Last-resort image: ASIN-based URL. Used when the social-bot
       UA fetch succeeds but the page didn't expose og:image (rare
       but seen on some Amazon variants). */
    (asin ? buildAmazonImageFromAsin(asin) : null);

  const { price, currency } = extractPrice(html);

  if (!rawTitle) {
    return NextResponse.json<SniffResult>({
      ok: !!asin,
      url: rawUrl,
      store,
      rawTitle: "",
      title: asin ? `Amazon product ${asin}` : "",
      brand: null,
      imageUrl,
      price,
      currency,
      asin,
      marketplace,
      error: asin ? undefined : "No product title found in page metadata",
    });
  }

  // AI-normalise
  const { title, brand } = await normalizeTitle(rawTitle, store);

  return NextResponse.json<SniffResult>(
    { ok: true, url: rawUrl, store, rawTitle, title, brand, imageUrl, price, currency, asin, marketplace },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" } },
  );
}
