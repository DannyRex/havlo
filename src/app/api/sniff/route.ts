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

/* Pull price + currency from a JSON-LD <script> block. JSON-LD is the
   modern e-commerce standard (Amazon, Shopify, BigCommerce, most
   Magento templates). The schema is Schema.org Product with nested
   offers. Variants we handle:
     - Single Product: { "@type": "Product", "offers": { "price": ... } }
     - Multiple Products: array of Product
     - AggregateOffer: { "offers": { "@type": "AggregateOffer",
                                      "lowPrice": ..., "priceCurrency": ... } }
     - Plain Offer: { "@type": "Offer", "price": ... } */
function extractPriceFromJsonLd(html: string): { price: number | null; currency: string | null } {
  /* Array.from() because the project's tsconfig target doesn't
     downlevel-iterate matchAll's RegExpStringIterator. Eager
     materialisation is fine — JSON-LD blocks per page typically
     count in single digits. */
  const blocks = Array.from(
    html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  );
  for (const m of blocks) {
    try {
      const json = JSON.parse(m[1].trim());
      const items: unknown[] = Array.isArray(json)
        ? json
        : json["@graph"]
          ? (json["@graph"] as unknown[])
          : [json];
      for (const item of items) {
        const result = pickPriceFromItem(item);
        if (result) return result;
      }
    } catch {
      // Malformed JSON — skip this block, try the next
    }
  }
  return { price: null, currency: null };
}

/* Recurse into a JSON-LD item looking for a price. Handles Product,
   Offer, AggregateOffer, and nested .offers objects. */
function pickPriceFromItem(
  item: unknown,
): { price: number; currency: string | null } | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  const direct = readPriceField(obj);
  if (direct) return direct;

  /* Nested offers object/array */
  const offers = obj["offers"];
  if (Array.isArray(offers)) {
    for (const o of offers) {
      const r = pickPriceFromItem(o);
      if (r) return r;
    }
  } else if (offers && typeof offers === "object") {
    const r = pickPriceFromItem(offers);
    if (r) return r;
  }

  return null;
}

/* Extract a numeric price + currency code from a single JSON-LD
   object (a Product, Offer, or AggregateOffer). */
function readPriceField(
  obj: Record<string, unknown>,
): { price: number; currency: string | null } | null {
  // Try price first, then lowPrice (AggregateOffer)
  const raw =
    obj["price"] ??
    obj["lowPrice"] ??
    obj["highPrice"] ??
    null;
  if (raw == null) return null;
  const price = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (!isFinite(price) || price <= 0) return null;
  const currency =
    (obj["priceCurrency"] as string | undefined) ??
    (obj["currency"] as string | undefined) ??
    null;
  return { price, currency };
}

function extractPrice(html: string): { price: number | null; currency: string | null } {
  /* 1. Try og: / product: meta tags first — fast path for sites that
        expose Open Graph product price (some Shopify themes, many
        Magento installs). */
  const ogAmount =
    extractMeta(html, "og:price:amount") ??
    extractMeta(html, "product:price:amount") ??
    extractMeta(html, "twitter:data1") ??
    null;
  const ogCurrency =
    extractMeta(html, "og:price:currency") ??
    extractMeta(html, "product:price:currency") ??
    null;
  if (ogAmount) {
    const price = parseFloat(ogAmount.replace(/[^0-9.]/g, ""));
    if (!isNaN(price) && price > 0) return { price, currency: ogCurrency };
  }

  /* 2. JSON-LD structured data — modern e-commerce standard. Amazon,
        most Shopify stores, and any site with proper SEO ships this. */
  const jsonLd = extractPriceFromJsonLd(html);
  if (jsonLd.price) return jsonLd;

  /* 3. Schema.org microdata — older sites (and some big retailers
        like Argos, Currys) expose price via itemprop attributes
        rather than og: meta. */
  const itempropMatch = html.match(
    /<(?:meta|span|div)[^>]+itemprop=["']price["'][^>]*(?:content|>)\s*=?\s*["']?([0-9][0-9.,]*)["']?/i,
  );
  if (itempropMatch?.[1]) {
    const price = parseFloat(itempropMatch[1].replace(/[^0-9.]/g, ""));
    if (!isNaN(price) && price > 0) {
      const currencyMatch = html.match(
        /itemprop=["']priceCurrency["'][^>]+content=["']([A-Z]{3})["']/i,
      );
      return { price, currency: currencyMatch?.[1] ?? null };
    }
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
    /* Multi-UA fallback chain. Different anti-bot vendors whitelist
       different social-media crawlers:
         - facebookexternalhit: works on Amazon, Shopify, most Magento,
           Cloudflare default rules
         - WhatsApp/2:          works on Akamai-protected sites
                                (next.co.uk, john lewis, some banks)
         - Twitterbot/1.0:      strong on US-centric sites
         - LinkedInBot/1.0:     last resort, narrow but distinctive UA

       Try them in priority order. Stop at the first that returns 2xx.
       Total worst-case latency = sum of failed timeouts (caps at ~5s
       per attempt). For the 90% common case (facebookexternalhit
       works), latency is unchanged. */
    const uaChain = [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.23.20.0 A",
      "Twitterbot/1.0",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; +https://www.linkedin.com)",
    ];
    let res: Response | null = null;
    for (const ua of uaChain) {
      try {
        const r = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent": ua,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(5_000),
          redirect: "follow",
        });
        if (r.ok) { res = r; break; }
      } catch {
        // timeout / network — try next UA
      }
    }
    if (!res) throw new Error("All UAs blocked");
    // Only read the <head> section — saves bandwidth, reduces parse time.
    // Stream and cut off after </head> or 64 KB, whichever comes first.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let chunk = "";
    /* 256 KB cap. Modern e-commerce <head> sections regularly hit
       100-200 KB (massive lists of preloads, font CSS, JSON-LD,
       inlined React state, every meta tag SEO best practice
       recommends). Stopping at 64 KB cut off the JSON-LD <script>
       block on Amazon and similar — which meant og:image worked but
       price extraction silently returned null even when the price
       was right there in structured data. 256 KB covers virtually
       every site without burning meaningful bandwidth. */
    const MAX_BYTES = 262_144;
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
    /* All bot UAs blocked AND slug yields nothing useful (opaque IDs
       like next.co.uk's /style/su800903/y02937).

       Rather than returning a hard error, surface a graceful fallback:
       store name from hostname + a generic title + favicon as the
       image. The user still sees "we recognise this is a Next.co.uk
       product, here's the link, click through to view it" instead of
       a "page blocked" wall. ok:true so the compare page renders the
       anchor card with cheaper-alternatives logic running on the title. */
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    const faviconImage = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
    return NextResponse.json<SniffResult>(
      {
        ok: !!asin || !!store,
        url: rawUrl,
        store,
        rawTitle: "",
        title: asin
          ? `Amazon product ${asin}`
          : store
            ? `Product on ${store}`
            : "External product",
        brand: null,
        imageUrl: fallbackImage ?? faviconImage,
        price: null,
        currency: null,
        asin,
        marketplace,
        error: !asin && !store
          ? "We couldn't read this page's details."
          : undefined,
      },
      {
        headers: {
          "Cache-Control":
            (asin || store)
              ? "s-maxage=300, stale-while-revalidate=3600"
              : "no-store",
        },
      },
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
