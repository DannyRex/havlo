/* ──────────────────────────────────────────────────────────────────
   Price-gap social card generator  (learning #2 — "price-disparity
   storytelling growth engine", from the Spoken/YC teardown).

   Havlo's whole reason to exist is that the SAME product costs wildly
   different amounts across stores. That disparity is the most
   shareable thing we have. This script turns it into 1200×630 PNG
   cards ready to post (Open Graph / Twitter / WhatsApp status / IG):

       "Sony WH-1000XM5  ·  Lowest ₦289,900  ·  Save ₦140,000 (33%)"

   It is a READ-ONLY reporting tool. It never writes to the DB. It
   reuses the exact same pipeline /compare uses so a card can never
   claim a saving the live compare page wouldn't also show:

     1. suggest_multistore_products(country)  — products that have BOTH
        a local and a cross-border store (the two legs of a real
        comparison; same RPC that powers the search-bar chips).
     2. pgFtsAnchorOffersByProductId(id)      — the pooled, in-stock,
        country-effective offer set for that product. This is the
        CHEAP anchor-only path: no dupes search, no embedding / LLM
        judge cost.
     3. effectiveLandedPrice(offer, country)  — per-visitor price
        (local stores show base price, cross-border adds the landed
        estimate), so the gap reflects what the shopper actually pays.

   Brand-safety note: the card NAMES the winning (cheapest) store —
   rewarding the best price is on-brand — but renders the dearest
   price WITHOUT naming the retailer ("Highest price found"). We don't
   publicly shame a named merchant in a viral image. The dearest store
   name is still recorded in manifest.json for internal reference.

   Honesty note (learning #4): no freshness claim is printed on the
   card. The anchor pipeline carries no per-offer scraped_at, and we
   will not imply "live" prices we can't prove. Cards say "Prices
   compared across N stores" — true and verifiable.

   Run (from the Havlo repo root):
     npx tsx --tsconfig tsconfig.scripts.json --env-file=.env.local \
       scripts/generate-price-gap-cards.ts --country ng --count 8

   Flags:
     --country <code>     market to price for (default: ng)
     --count <n>          max cards to emit (default: 8)
     --min-gap-pct <n>    skip products whose saving is under n% (default: 12)
     --max-gap-pct <n>    skip products over n% (likely a bad match) (default: 85)
     --pool <n>           candidate products to pull from the RPC (default: 60)
     --out <dir>          output directory (default: scripts/output/price-gap-cards)
   ────────────────────────────────────────────────────────────────── */

// @ts-ignore — playwright-extra has no bundled TS types
import { chromium } from "playwright-extra";
// @ts-ignore
import StealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(StealthPlugin());

import type { Browser, Page } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getSupabaseAdmin } from "../src/lib/providers/db-client";
import { pgFtsAnchorOffersByProductId } from "../src/lib/search/pg-fts";
import type { StoreOffer } from "../src/lib/search/index";
import { getCountry, isOfferAllowedForCountry } from "../src/lib/country";
import { effectiveLandedPrice, isCrossBorderForUser } from "../src/lib/landed-price";
import { formatPriceForUser } from "../src/lib/utils";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/* ── CLI ──────────────────────────────────────────────────────────── */
function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
const COUNTRY_CODE = arg("--country", "ng").toLowerCase();
const COUNT        = parseInt(arg("--count", "8"), 10);
const MIN_GAP_PCT  = parseInt(arg("--min-gap-pct", "12"), 10);
const MAX_GAP_PCT  = parseInt(arg("--max-gap-pct", "85"), 10);
const POOL         = parseInt(arg("--pool", "60"), 10);
const OUT_DIR      = path.resolve(arg("--out", path.join("scripts", "output", "price-gap-cards")));

/* ── Types ────────────────────────────────────────────────────────── */
interface CardData {
  productId:        string;
  title:            string;
  imageUrl:         string | null;
  cheapestStore:    string;
  cheapestPriceStr: string;
  cheapestCrossBorder: boolean;
  cheapestVerified: boolean;
  dearestStore:     string;   // manifest only, NOT rendered
  dearestPriceStr:  string;
  savingsStr:       string;
  gapPct:           number;
  storeCount:       number;
  gapNgn:           number;    // ranking key (raw NGN)
}

/* ── RPC row shape ────────────────────────────────────────────────── */
interface MultiStoreRow {
  product_id:   string;
  title:        string;
  store_count:  number;
  total_offers: number;
}

/* ── Candidate honesty / quality guards ───────────────────────────────
   These cards are public marketing. Two title classes get dropped:

   1. Refurbished / used / open-box. The saving vs a NEW listing isn't a
      like-for-like comparison — posting "Save ₦500k" when the cheap leg
      is a used unit is the exact dishonesty learning #4 warns against.
   2. Accessories (cases, cables, straps…). The signature pooler
      occasionally merges a real-device offer under an accessory product
      (observed: an "iPhone 15 Pro Max ... Phone Case" anchoring a ₦1.1M
      lowest price). Accessories also make weak price-gap stories. Cheap
      to exclude wholesale, removes the biggest embarrassment risk. */
const REFURB_RE =
  /\b(refurb(ished)?|renewed|pre[-\s]?owned|used|second[-\s]?hand|open[-\s]?box|restored|reconditioned)\b/i;
const ACCESSORY_RE =
  /\b(case|cover|sleeve|adapter|cable|charger|stand|mount|protector|screen\s*guard|tempered\s*glass|skin|pouch|strap|band|holster|grip|dock|keyboard\s*cover)\b/i;

function isRefurbishedTitle(t: string): boolean { return REFURB_RE.test(t); }
function isAccessoryTitle(t: string): boolean { return ACCESSORY_RE.test(t); }

/* Second-hand / pawn chains. Their listings are often used units with
   no "used" token in the title, so the refurb-title guard misses them.
   Headlining their price as the "lowest" against new offers is a
   used-vs-new comparison — misleading on a public card (learning #4).
   Store-name match only; extend as more such chains appear in catalog. */
const USED_GOODS_STORE_RE = /\b(cash\s*converters|cash\s*crusaders|cashconverters|cex)\b/i;
function isUsedGoodsStore(name: string): boolean { return USED_GOODS_STORE_RE.test(name); }

/* Marketplaces list a seller handle in the store name ("eBay -
   new.techies", "Amazon - SomeShop"). On a card that reads as
   unprofessional, so collapse to the marketplace brand. Only fires when
   the prefix is a known marketplace, so legitimately hyphenated local
   store names ("3C Hub - Ikeja") are left intact. */
const MARKETPLACE_PREFIX_RE =
  /^(eBay|Amazon|AliExpress|Alibaba|Etsy|Walmart|DHgate|Temu|Shein)\s*[-|–—·:]\s*\S/i;
function cleanStoreName(name: string): string {
  const trimmed = name.trim();
  const m = trimmed.match(MARKETPLACE_PREFIX_RE);
  return m ? m[1] : trimmed;
}

/* ── Build one card's data from a candidate product ───────────────── */
async function buildCard(
  row: MultiStoreRow,
  imageByProductId: Map<string, string>,
): Promise<CardData | null> {
  const country = getCountry(COUNTRY_CODE);

  /* Honesty / mismatch guards — cheapest possible early-out, before any
     DB round-trip for offers. */
  if (isRefurbishedTitle(row.title)) return null;
  if (isAccessoryTitle(row.title))  return null;

  let offers: StoreOffer[];
  try {
    offers = await pgFtsAnchorOffersByProductId(row.product_id);
  } catch (err) {
    console.warn(`  ! ${row.product_id} anchor fetch failed: ${(err as Error).message}`);
    return null;
  }
  if (offers.length < 2) return null;

  /* Keep only offers a shopper in this country would actually see on
     /compare (drops e.g. a UK-only retailer for an NG visitor; keeps
     local stores + global cross-border stores). */
  const visible = offers.filter((o) => isOfferAllowedForCountry(o, country));
  if (visible.length < 2) return null;

  /* One offer per store, keyed on the visitor-effective price. */
  const byStore = new Map<string, { offer: StoreOffer; eff: number }>();
  for (const o of visible) {
    const eff = effectiveLandedPrice(o, country);
    if (!Number.isFinite(eff) || eff <= 0) continue;
    const prev = byStore.get(o.storeId);
    if (!prev || eff < prev.eff) byStore.set(o.storeId, { offer: o, eff });
  }

  const rows = Array.from(byStore.values()).sort((a, b) => a.eff - b.eff);
  if (rows.length < 2) return null;

  const cheapest = rows[0];
  const dearest  = rows[rows.length - 1];

  /* If the headline (cheapest) store is a known second-hand chain, the
     "lowest price" is almost certainly a used unit — skip rather than
     imply a like-for-like new-product saving. */
  if (isUsedGoodsStore(cheapest.offer.storeName)) return null;

  const gapNgn   = dearest.eff - cheapest.eff;
  const gapPct   = Math.round((gapNgn / dearest.eff) * 100);

  if (gapNgn <= 0) return null;
  if (gapPct < MIN_GAP_PCT) return null;
  if (gapPct > MAX_GAP_PCT) return null;   // implausible — likely a pooling mismatch

  /* Product image: the canonical products.image_url (batch-fetched in
     main — the anchor offer query doesn't select an image column), then
     fall back to any offer that happens to carry one. Cards still render
     cleanly without it (a tag-glyph placeholder). */
  const imageUrl =
    imageByProductId.get(row.product_id) ||
    cheapest.offer.imageUrl ||
    rows.map((r) => r.offer.imageUrl).find((u) => !!u) ||
    null;

  return {
    productId:           row.product_id,
    title:               row.title.trim(),
    imageUrl:            imageUrl ?? null,
    cheapestStore:       cleanStoreName(cheapest.offer.storeName),
    cheapestPriceStr:    formatPriceForUser(cheapest.eff, country),
    cheapestCrossBorder: isCrossBorderForUser(cheapest.offer, country),
    cheapestVerified:    cheapest.offer.trust === "established",
    dearestStore:        dearest.offer.storeName,
    dearestPriceStr:     formatPriceForUser(dearest.eff, country),
    savingsStr:          formatPriceForUser(gapNgn, country),
    gapPct,
    storeCount:          rows.length,
    gapNgn,
  };
}

/* ── HTML ─────────────────────────────────────────────────────────── */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const VERIFIED_MARK = `
  <span class="verified" title="We verified this retailer's official website">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    Verified
  </span>`;

function cardHtml(c: CardData): string {
  const crossBorderNote = c.cheapestCrossBorder
    ? `<span class="xb">incl. est. import cost</span>`
    : "";

  const media = c.imageUrl
    ? `<img src="${esc(c.imageUrl)}" alt="" referrerpolicy="no-referrer"
            onerror="this.style.display='none';document.getElementById('fallback').style.display='flex';" />
       <div id="fallback" class="fallback" style="display:none">
         <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgb(148 163 184)"
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/>
           <circle cx="7" cy="7" r="1.2"/></svg>
       </div>`
    : `<div class="fallback" style="display:flex">
         <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgb(148 163 184)"
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/>
           <circle cx="7" cy="7" r="1.2"/></svg>
       </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#0F172A; --ink-2:rgb(71 85 105); --ink-3:rgb(94 106 126);
    --border:rgb(228 230 235); --surface-2:rgb(247 248 250);
    --brand:#0057FF; --success:#166534; --success-subtle:rgba(22,101,52,0.08);
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#e9ecf1;}
  #card{
    width:1200px;height:630px;background:#FFFFFF;
    border:1px solid var(--border);
    padding:56px 60px;display:flex;flex-direction:column;
    font-family:"Inter",system-ui,sans-serif;color:var(--ink);
    -webkit-font-smoothing:antialiased;position:relative;overflow:hidden;
  }
  /* hairline brand accent down the left edge */
  #card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--brand);}
  header{display:flex;align-items:center;justify-content:space-between;}
  .wordmark{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:23px;letter-spacing:-0.01em;color:var(--ink);}
  .wordmark b{color:var(--brand);}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink-3);}

  main{flex:1;display:flex;gap:48px;align-items:stretch;margin-top:34px;min-height:0;}
  .media{
    width:362px;flex:none;background:var(--surface-2);border:1px solid var(--border);
    border-radius:22px;display:flex;align-items:center;justify-content:center;padding:26px;
  }
  .media img{max-width:100%;max-height:100%;object-fit:contain;}
  .fallback{width:100%;height:100%;align-items:center;justify-content:center;}

  .content{flex:1;display:flex;flex-direction:column;min-width:0;}
  .title{
    font-family:"Bricolage Grotesque",sans-serif;font-weight:600;font-size:33px;line-height:1.18;
    color:var(--ink);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  }
  .sub{margin-top:12px;font-size:14px;font-weight:500;color:var(--ink-3);}

  .prices{margin-top:auto;display:flex;flex-direction:column;}
  .row{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;}
  .row .meta{display:flex;flex-direction:column;gap:5px;min-width:0;}
  .row .tag{font-size:11.5px;font-weight:600;letter-spacing:0.13em;text-transform:uppercase;}
  .row.best .tag{color:var(--success);}
  .row.high .tag{color:var(--ink-3);}
  .row .store{font-size:17px;font-weight:600;color:var(--ink-2);display:flex;align-items:center;gap:10px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px;}
  .row .amount{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;line-height:0.95;white-space:nowrap;}
  .row.best .amount{font-size:48px;color:var(--success);}
  .row.high .amount{font-size:30px;color:var(--ink-3);text-decoration:line-through;text-decoration-thickness:2px;}
  .xb{font-size:12px;font-weight:500;color:var(--ink-3);}

  .verified{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--success);
    background:var(--success-subtle);border:1px solid rgba(22,101,52,0.16);padding:3px 9px 3px 7px;border-radius:999px;}
  .verified svg{display:block;}

  .divider{height:1px;background:var(--border);margin:18px 0;}

  .hook{display:inline-flex;align-items:baseline;gap:12px;align-self:flex-start;margin-top:20px;
    background:var(--success-subtle);border:1px solid rgba(22,101,52,0.18);padding:13px 20px;border-radius:14px;}
  .hook .amt{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:27px;color:var(--success);}
  .hook .pct{font-size:15px;font-weight:600;color:var(--success);opacity:0.85;}

  footer{display:flex;align-items:center;justify-content:space-between;margin-top:30px;
    padding-top:22px;border-top:1px solid var(--border);}
  .foot-brand{font-size:14px;font-weight:600;color:var(--ink-2);}
  .foot-brand b{color:var(--brand);}
  .foot-note{font-size:13px;font-weight:500;color:var(--ink-3);}
</style>
</head>
<body>
  <div id="card">
    <header>
      <div class="wordmark">Havlo<b>.</b></div>
      <div class="eyebrow">Price comparison</div>
    </header>

    <main>
      <div class="media">${media}</div>

      <div class="content">
        <div class="title">${esc(c.title)}</div>
        <div class="sub">Compared across ${c.storeCount} stores</div>

        <div class="prices">
          <div class="row best">
            <div class="meta">
              <span class="tag">Lowest price</span>
              <span class="store">${esc(c.cheapestStore)}${c.cheapestVerified ? VERIFIED_MARK : ""}</span>
              ${crossBorderNote}
            </div>
            <span class="amount">${esc(c.cheapestPriceStr)}</span>
          </div>

          <div class="divider"></div>

          <div class="row high">
            <div class="meta">
              <span class="tag">Highest price found</span>
            </div>
            <span class="amount">${esc(c.dearestPriceStr)}</span>
          </div>
        </div>

        <div class="hook">
          <span class="amt">Save ${esc(c.savingsStr)}</span>
          <span class="pct">${c.gapPct}% cheaper</span>
        </div>
      </div>
    </main>

    <footer>
      <div class="foot-brand">havlo<b>.</b>com</div>
      <div class="foot-note">Compare prices across stores before you buy</div>
    </footer>
  </div>
</body>
</html>`;
}

/* ── Filename slug ────────────────────────────────────────────────── */
function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "product";
}

/* ── Render a card to PNG via Playwright ──────────────────────────── */
async function renderCard(page: Page, c: CardData, file: string): Promise<void> {
  await page.setContent(cardHtml(c), { waitUntil: "domcontentloaded" });
  /* Wait until every <img> has settled — .complete flips true on BOTH
     load and error, so a slow/blocked merchant CDN can't hang the batch
     past the 5s cap. The predicate uses only inline anonymous arrows
     (no `const fn = …` bindings): tsx/esbuild's keepNames transform
     injects a `__name()` helper around named function expressions, and
     that helper isn't defined inside the browser page context, so a
     named inner arrow here throws "ReferenceError: __name is not
     defined" at evaluate time. */
  await page
    .waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      undefined,
      { timeout: 5000 },
    )
    .catch(() => undefined);
  /* Let webfonts finish swapping in before we shoot. Async arrow is an
     inline arg (no named binding) so it's keepNames-safe. */
  await page.evaluate(async () => {
    try {
      await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    } catch {
      /* fonts API absent — proceed */
    }
  });
  /* Small settle for layout/paint after fonts swap in. */
  await page.waitForTimeout(150);
  const el = await page.$("#card");
  if (!el) throw new Error("card element not found");
  await el.screenshot({ path: file });
}

/* ── Main ─────────────────────────────────────────────────────────── */
async function main(): Promise<void> {
  const country = getCountry(COUNTRY_CODE);
  console.log(
    `\nPrice-gap cards · ${country.flag} ${country.name} · target ${COUNT} · ` +
      `gap ${MIN_GAP_PCT}-${MAX_GAP_PCT}%\n`,
  );

  const supa = getSupabaseAdmin();
  if (!supa) {
    console.error("No Supabase admin client (check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in --env-file).");
    process.exit(1);
  }

  const { data, error } = await supa.rpc("suggest_multistore_products", {
    user_country: COUNTRY_CODE,
    max_results:  POOL,
  });
  if (error) {
    console.error("RPC suggest_multistore_products failed:", error.message);
    process.exit(1);
  }
  const candidates = (data ?? []) as MultiStoreRow[];
  console.log(`Pulled ${candidates.length} multi-store candidates. Building cards...\n`);

  /* Batch-fetch canonical product images — the anchor offer query
     doesn't carry one, so without this every card falls back to the
     placeholder glyph. One indexed SELECT per 200-id chunk. */
  const imageByProductId = new Map<string, string>();
  const ids = candidates.map((r) => r.product_id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: imgs } = await supa
      .from("products")
      .select("id, image_url")
      .in("id", ids.slice(i, i + 200));
    for (const p of (imgs ?? []) as Array<{ id: string; image_url: string | null }>) {
      if (p.image_url) imageByProductId.set(p.id, p.image_url);
    }
  }

  /* Build card data for each candidate, keep the ones that clear the
     gap thresholds, rank by absolute NGN saving (biggest story first). */
  const cards: CardData[] = [];
  for (const row of candidates) {
    const card = await buildCard(row, imageByProductId);
    if (card) {
      cards.push(card);
      console.log(
        `  ✓ ${card.savingsStr} (${card.gapPct}%)  ${card.cheapestStore}  ·  ${card.title.slice(0, 52)}`,
      );
    }
    if (cards.length >= COUNT * 3) break; // enough to rank from; stop hammering the DB
  }

  cards.sort((a, b) => b.gapNgn - a.gapNgn);
  const chosen = cards.slice(0, COUNT);

  if (chosen.length === 0) {
    console.log("\nNo products cleared the gap thresholds. Try a lower --min-gap-pct.\n");
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`\nRendering ${chosen.length} cards to ${OUT_DIR}\n`);
  let browser: Browser | null = null;
  const manifest: Array<Record<string, unknown>> = [];
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 2,
      userAgent: UA,
    });
    const page = await context.newPage();

    let rank = 1;
    for (const c of chosen) {
      const name = `${String(rank).padStart(2, "0")}-${slug(c.title)}.png`;
      const file = path.join(OUT_DIR, name);
      try {
        await renderCard(page, c, file);
        console.log(`  → ${name}`);
        manifest.push({
          rank,
          file: name,
          productId:     c.productId,
          title:         c.title,
          cheapestStore: c.cheapestStore,
          cheapestPrice: c.cheapestPriceStr,
          dearestStore:  c.dearestStore,
          dearestPrice:  c.dearestPriceStr,
          savings:       c.savingsStr,
          gapPct:        c.gapPct,
          storeCount:    c.storeCount,
          verified:      c.cheapestVerified,
        });
        rank++;
      } catch (err) {
        console.warn(`  ! failed to render "${c.title.slice(0, 40)}": ${(err as Error).message}`);
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  const manifestPath = path.join(OUT_DIR, "manifest.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      { country: COUNTRY_CODE, generatedAt: new Date().toISOString(), count: manifest.length, cards: manifest },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nDone. ${manifest.length} cards + manifest.json in ${OUT_DIR}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
