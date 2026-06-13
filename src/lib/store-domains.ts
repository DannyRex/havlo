/* Canonical retailer domains for store-logo favicon resolution.

   Why this exists (Finding #7, pre-launch QA): the compare-row
   <StoreLogo> falls back to a Google s2 favicon whenever no
   /logos/<storeId>.png is bundled — and only ~60 of those files ship,
   so every long-tail retailer hits the fallback. Previously that
   favicon was keyed on the OFFER'S MERCHANT URL host, which is
   unreliable: relays, Google-Shopping redirect hosts, and mis-parsed
   URLs made s2 return a generic Google globe (the report: "JD Sports
   shown with Google's G logo"). Keying the favicon on the retailer's
   OWN canonical domain instead yields the correct brand icon
   regardless of what the offer URL happens to look like.

   The domains here mirror the curated marquee roster in
   components/landing/StoreLogos.tsx. They are kept as a separate,
   focused map ON PURPOSE: the homepage hero store-count math reads
   that roster, and a logo tweak must never be able to disturb it.

   Amazon / eBay / Walmart / Currys / Dell / QVC are intentionally
   omitted — their storeIds carry marketplace-variant suffixes and they
   already collapse to a bundled /logos asset in resolveStoreLogoUrl,
   so the favicon tier is never reached for them. */

import { toAbsoluteMerchantUrl } from "@/lib/pdp-url";
import { marketplaceBaseSlug } from "@/lib/store-logo";

/** Normalise a store id or display name to a comparable slug:
    lowercase, alphanumerics only. "JD Sports" and "jd-sports" both
    collapse to "jdsports", so the same map entry resolves whether the
    caller passes the DB storeId or the display storeName. */
export function canonicalStoreSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const STORE_DOMAINS: Record<string, string> = {
  // ── UK ──
  jdsports: "jdsports.com",
  sportsdirect: "sportsdirect.com",
  argos: "argos.co.uk",
  johnlewis: "johnlewis.com",
  boots: "boots.com",
  next: "next.co.uk",
  ms: "marksandspencer.com",
  marksandspencer: "marksandspencer.com",
  very: "very.co.uk",
  ao: "ao.com",
  selfridges: "selfridges.com",
  debenhams: "debenhams.com",
  dunelm: "dunelm.com",
  halfords: "halfords.com",
  bq: "diy.com",
  smythstoys: "smythstoys.com",
  asos: "asos.com",
  // ── UK (Awin June 2026 ingest) ──
  zonky: "zonky.uk",
  morishsnacks: "morishsnacks.co.uk",
  gardenistauk: "gardenistauk.com",
  gameoverstore: "gameoverstore.co.uk",
  // ── US ──
  bestbuy: "bestbuy.com",
  target: "target.com",
  newegg: "newegg.com",
  // US (CJ June 2026 ingest). Keys are canonicalStoreSlug form (alnum
  // only): store_id "electronic-express" -> "electronicexpress",
  // "plesser-s-appliances" -> "plessersappliances".
  ecosmetics: "ecosmetics.com",
  electronicexpress: "electronicexpress.com",
  plessersappliances: "plessers.com",
  costco: "costco.com",
  macys: "macys.com",
  nordstrom: "nordstrom.com",
  sephora: "sephora.com",
  ulta: "ulta.com",
  homedepot: "homedepot.com",
  lowes: "lowes.com",
  kohls: "kohls.com",
  jcpenney: "jcpenney.com",
  wayfair: "wayfair.com",
  etsy: "etsy.com",
  // ── NG ──
  jumia: "jumia.com.ng",
  konga: "konga.com",
  // eBay: bundled /logos/ebay.png is a 16x16 placeholder, so it's
  // de-bundled (June 2026) and resolves a crisp ebay.com favicon instead.
  // resolveStoreDomain() collapses ebay-<seller> variants via
  // marketplaceBaseSlug, so every per-seller card resolves here too.
  ebay: "ebay.com",
  jiji: "jiji.ng",
  slot: "slot.ng",
  kara: "kara.com.ng",
  obiwezy: "obiwezy.com",
  spar: "sparnigeria.com",
  healthplus: "healthplusnigeria.com",
  medplus: "medplusnig.com",
  supermart: "supermart.ng",
  pointek: "pointekonline.com",
  booze: "booze.ng",
  myliquorhub: "myliquorhub.com",
  essenza: "essenza.ng",
  ajebomarket: "ajebomarket.com",
  fouani: "fouanistore.com",
  // ── DE ──
  mediamarkt: "mediamarkt.de",
  saturn: "saturn.de",
  zalando: "zalando.de",
  otto: "otto.de",
  idealo: "idealo.de",
  lidl: "lidl.de",
  cyberport: "cyberport.de",
  houseofsneakers: "house-of-sneakers.de",
  // ── AE ──
  noon: "noon.com",
  sharafdg: "sharafdg.com",
  carrefour: "carrefouruae.com",
  lulu: "luluhypermarket.com",
  centrepoint: "centrepointstores.com",
  namshi: "namshi.com",
  ounass: "ounass.ae",
  // ── IN ──
  flipkart: "flipkart.com",
  myntra: "myntra.com",
  ajio: "ajio.com",
  tatacliq: "tatacliq.com",
  nykaa: "nykaa.com",
  croma: "croma.com",
  reliancedigital: "reliancedigital.in",
  meesho: "meesho.com",
  snapdeal: "snapdeal.com",
  // ── ZA ──
  takealot: "takealot.com",
  makro: "makro.co.za",
  game: "game.co.za",
  loot: "loot.co.za",
  yuppiechef: "yuppiechef.com",
  superbalist: "superbalist.com",
  // ── Cross-border globals ──
  aliexpress: "aliexpress.com",
  shein: "shein.com",
  temu: "temu.com",
  dhgate: "dhgate.com",

  /* ── Expanded coverage (June 2026 logo audit) ──
     The store-logo audit found 939 in-stock stores falling to a bare
     letter badge — many of them recognisable retailers simply absent
     from this map. Keys are canonicalStoreSlug form (lowercase, alnum
     only) so they match whatever storeId/storeName variant the DB holds.
     Domains verified by eye against the retailer's live site. */
  // UK
  hsamuel: "hsamuel.co.uk",
  ernestjones: "ernestjones.co.uk",
  moss: "moss.co.uk",
  superdrug: "superdrug.com",
  hollandbarrett: "hollandandbarrett.com",
  matalan: "matalan.co.uk",
  officeshoes: "office.co.uk",
  theperfumeshop: "theperfumeshop.com",
  boohoo: "boohoo.com",
  prettylittlething: "prettylittlething.com",
  gymshark: "gymshark.com",
  footasylum: "footasylum.com",
  frasers: "frasers.com",
  flannels: "flannels.com",
  ocado: "ocado.com",
  appliancesdirect: "appliancesdirect.co.uk",
  homeoutletdirect: "homeoutletdirect.co.uk",
  hughes: "hughes.co.uk",
  dorothyperkinsuk: "dorothyperkins.com",
  coast: "coastfashion.com",
  accessorize: "accessorize.com",
  hobbycraft: "hobbycraft.co.uk",
  endclothing: "endclothing.com",
  justmylook: "justmylook.com",
  decathlonuk: "decathlon.co.uk",
  hm: "hm.com",
  // US
  academysportsoutdoors: "academy.com",
  belk: "belk.com",
  footlocker: "footlocker.com",
  champssports: "champssports.com",
  gamestop: "gamestop.com",
  abercrombiefitch: "abercrombie.com",
  fragrancenet: "fragrancenet.com",
  stockx: "stockx.com",
  goat: "goat.com",
  mercari: "mercari.com",
  brandsmartusa: "brandsmartusa.com",
  lodgecastiron: "lodgecastiron.com",
  wilsonsportinggoods: "wilson.com",
  ultabeauty: "ulta.com",
  charlottetilbury: "charlottetilbury.com",
  drunkelephantskincare: "drunkelephant.com",
  levis: "levi.com",
  puma: "puma.com",
  lenovo: "lenovo.com",
  etsyseller: "etsy.com",
  shopsimon: "shopsimon.com",
  // IN
  bigbasket: "bigbasket.com",
  pantaloons: "pantaloons.com",
  tatacliqfashion: "tatacliq.com",
  mamaearth: "mamaearth.in",
  hyugalife: "hyugalife.com",
  perniaspopupshop: "perniaspopupshop.com",
  superkicks: "superkicks.in",
  boat: "boat-lifestyle.com",
  // DE
  refurbedde: "refurbed.com",
  booztde: "boozt.com",
  // misc cross-border
  techinn: "tradeinn.com",
  kitlocker: "kitlocker.com",
  mcgrocer: "mcgrocer.com",
  doverstreetmarket: "doverstreetmarket.com",
  georgeatasda: "george.com",
};

/* Hosts that are never a real merchant storefront — Google properties
   and ad redirectors. When an offer URL resolves to one of these we
   must NOT build a favicon for it: Google's s2 service would hand back
   a generic Google globe, the exact wrong-logo symptom in Finding #7.
   Returning null instead lets <StoreLogo> degrade to its letter badge,
   which reads as intentional rather than as a mismatched brand. */
const NON_MERCHANT_HOSTS = [
  "google.com",
  "googleadservices.com",
  "googleusercontent.com",
  "doubleclick.net",
  "gstatic.com",
];

function hostFromMerchantUrl(merchantUrl?: string): string | null {
  if (!merchantUrl) return null;
  try {
    /* toAbsoluteMerchantUrl unwraps the /api/go relay so we read the
       real merchant hostname, not the relay's. */
    const host = new URL(toAbsoluteMerchantUrl(merchantUrl)).hostname.toLowerCase();
    if (!host) return null;
    if (NON_MERCHANT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    return host;
  } catch {
    return null;
  }
}

/** Resolve the most reliable domain to use for a store's favicon.
    Priority: curated canonical domain (matched on storeId slug, then
    storeName slug) → the offer's own merchant-URL host → null (the
    caller then shows its letter badge). The curated map wins because
    the merchant URL can be a relay / Google-Shopping redirect /
    mis-parsed host that yields the wrong favicon. Finding #7. */
export function resolveStoreDomain(
  storeId: string,
  storeName: string,
  merchantUrl?: string,
): string | null {
  const curated =
    /* Collapse marketplace seller/regional variants first
       (ebay-<seller> → ebay) so the favicon resolves for every variant,
       not just the bare base id. */
    STORE_DOMAINS[canonicalStoreSlug(marketplaceBaseSlug(storeId))] ??
    STORE_DOMAINS[canonicalStoreSlug(storeId)] ??
    STORE_DOMAINS[canonicalStoreSlug(storeName)];
  if (curated) return curated;
  return hostFromMerchantUrl(merchantUrl);
}
