import { getServerCountry } from "@/lib/country-server";
import { StoreLogoChip, type StoreEntry } from "./StoreLogoChip";

/* Per-country marquee rosters.

   Cross-border tail is country-specific because shopping habits vary:
     - Nigerians import from Amazon (US/UK), AliExpress, ASOS, Shein,
       Temu, DHgate — proven shippers + payment routes that work
     - Indians can't use Shein (banned in 2020); cross-border is mostly
       Amazon Global + AliExpress due to import duties
     - Americans rarely shop foreign retailers; cross-border = Shein +
       Temu + AliExpress (the China direct-to-consumer trio)
     - UK / DE / AE / ZA mirror the US pattern with regional tweaks */
const ROSTERS: Record<string, StoreEntry[]> = {
  /* NG roster — order tracks actual NG shopping volume:
     local first (Jumia is #1 by a clear margin), then cross-border
     ordered by NG-shopper preference (Temu surging, AliExpress
     long-favorite, Shein for fashion, Amazon for everything else). */
  ng: [
    { name: "Jumia",      domain: "jumia.com.ng" },
    { name: "Konga",      domain: "konga.com" },
    { name: "Jiji",       domain: "jiji.ng" },
    { name: "Slot",       domain: "slot.ng" },
    { name: "Kara",       domain: "kara.com.ng" },
    /* 3C Hub: their site has no favicon.ico / apple-touch-icon, so
       Google s2 returns nothing usable. Bundled their wordmark from
       the homepage header (downloaded to /public/logos/3chub.png).
       wideLogo: wordmark is wider than tall, render in a wider chip.
       whiteLogo: the wordmark is white-on-transparent so it goes
       invisible on the chip's white surface in light mode — the
       chip flips it via `invert` in light, `invert-0` in dark. */
    { name: "3C Hub",     domain: "3chub.com", logo: "/logos/3chub.png", wideLogo: true, whiteLogo: true },
    { name: "Obiwezy",    domain: "obiwezy.com" },
    /* PayPorte: scraper is disabled (robots.txt) but they're still
       part of the NG retail landscape and worth showing. icon.horse
       + the StoreLogoChip onError fallback will render a clean "P"
       letter chip if the favicon returns broken / wrong. */
    { name: "PayPorte",   domain: "payporte.com" },
    { name: "Spar",       domain: "sparnigeria.com" },
    /* Newly-scraped NG retailers (May 2026 batch) — pharmacies,
       grocery, fragrance. All four ingest into Havlo via the
       direct scrapers in scripts/scrapers/, NOT SerpAPI. The Hero
       trust pill ("scanning prices across N stores") reads the
       length of this list, so adding these four bumps the count
       from 16 → 20 honestly. */
    { name: "HealthPlus", domain: "healthplusnigeria.com" },
    { name: "MedPlus",    domain: "medplusnig.com" },
    { name: "Supermart",  domain: "supermart.ng" },
    { name: "Essenza",    domain: "essenza.ng" },
    // Cross-border, in NG-shopper preference order
    { name: "Temu",       domain: "temu.com" },
    { name: "AliExpress", domain: "aliexpress.com" },
    { name: "SHEIN",      domain: "shein.com" },
    { name: "Amazon",     domain: "amazon.com" },
    { name: "ASOS",       domain: "asos.com" },
    { name: "DHgate",     domain: "dhgate.com" },
    { name: "eBay",       domain: "ebay.com" },
  ],
  uk: [
    // Local UK retailers
    { name: "Amazon UK",  domain: "amazon.co.uk" },
    { name: "ASOS",       domain: "asos.com" },
    { name: "Argos",      domain: "argos.co.uk" },
    { name: "Currys",     domain: "currys.co.uk" },
    { name: "John Lewis", domain: "johnlewis.com" },
    { name: "Boots",      domain: "boots.com" },
    { name: "Next",       domain: "next.co.uk" },
    { name: "M&S",        domain: "marksandspencer.com" },
    { name: "Very",       domain: "very.co.uk" },
    { name: "AO.com",     domain: "ao.com" },
    // Cross-border UK shoppers actually use
    { name: "AliExpress", domain: "aliexpress.com" },
    { name: "SHEIN",      domain: "shein.com" },
    { name: "Temu",       domain: "temu.com" },
    { name: "DHgate",     domain: "dhgate.com" },
  ],
  us: [
    { name: "Amazon",     domain: "amazon.com" },
    { name: "Walmart",    domain: "walmart.com" },
    { name: "Best Buy",   domain: "bestbuy.com" },
    { name: "Target",     domain: "target.com" },
    { name: "eBay",       domain: "ebay.com" },
    { name: "Newegg",     domain: "newegg.com" },
    { name: "Costco",     domain: "costco.com" },
    { name: "Nordstrom",  domain: "nordstrom.com" },
    { name: "Wayfair",    domain: "wayfair.com" },
    { name: "Etsy",       domain: "etsy.com" },
    { name: "SHEIN",      domain: "shein.com" },
    { name: "Temu",       domain: "temu.com" },
    { name: "AliExpress", domain: "aliexpress.com" },
  ],
  de: [
    { name: "Amazon DE",  domain: "amazon.de" },
    { name: "MediaMarkt", domain: "mediamarkt.de" },
    { name: "Saturn",     domain: "saturn.de" },
    { name: "Zalando",    domain: "zalando.de" },
    { name: "Otto",       domain: "otto.de" },
    { name: "Idealo",     domain: "idealo.de" },
    { name: "Lidl",       domain: "lidl.de" },
    { name: "Cyberport",  domain: "cyberport.de" },
    { name: "AliExpress", domain: "aliexpress.com" },
    { name: "SHEIN",      domain: "shein.com" },
    { name: "Temu",       domain: "temu.com" },
  ],
  ae: [
    { name: "Amazon AE",  domain: "amazon.ae" },
    { name: "Noon",       domain: "noon.com" },
    { name: "Sharaf DG",  domain: "sharafdg.com" },
    { name: "Carrefour",  domain: "carrefouruae.com" },
    { name: "Lulu",       domain: "luluhypermarket.com" },
    { name: "Centrepoint",domain: "centrepointstores.com" },
    { name: "Namshi",     domain: "namshi.com" },
    { name: "Ounass",     domain: "ounass.ae" },
    { name: "Amazon US",  domain: "amazon.com" },
    { name: "AliExpress", domain: "aliexpress.com" },
    { name: "SHEIN",      domain: "shein.com" },
    { name: "Temu",       domain: "temu.com" },
  ],
  in: [
    { name: "Amazon IN",         domain: "amazon.in" },
    { name: "Flipkart",          domain: "flipkart.com" },
    { name: "Myntra",            domain: "myntra.com" },
    { name: "Ajio",              domain: "ajio.com" },
    { name: "Tata CLiQ",         domain: "tatacliq.com" },
    { name: "Nykaa",             domain: "nykaa.com" },
    { name: "Croma",             domain: "croma.com" },
    { name: "Reliance Digital",  domain: "reliancedigital.in" },
    { name: "Meesho",            domain: "meesho.com" },
    { name: "Snapdeal",          domain: "snapdeal.com" },
    { name: "AliExpress",        domain: "aliexpress.com" },
  ],
  za: [
    { name: "Takealot",   domain: "takealot.com" },
    { name: "Makro",      domain: "makro.co.za" },
    { name: "Game",       domain: "game.co.za" },
    { name: "Loot",       domain: "loot.co.za" },
    { name: "Yuppiechef", domain: "yuppiechef.com" },
    { name: "Superbalist",domain: "superbalist.com" },
    { name: "Amazon",     domain: "amazon.co.za" },
    { name: "AliExpress", domain: "aliexpress.com" },
    { name: "SHEIN",      domain: "shein.com" },
    { name: "Temu",       domain: "temu.com" },
  ],
};

/* Public helper: how many stores does Havlo cover for the given
   country? Used by the Hero trust pill to show an accurate, honest
   "scanning prices across N stores" count that matches the marquee
   the user actually sees below. Defaults to NG roster when the
   country code is unknown. */
export function getStoreCountForCountry(countryCode: string): number {
  return (ROSTERS[countryCode] ?? ROSTERS.ng).length;
}

function Track({ stores, ariaHidden = false }: { stores: StoreEntry[]; ariaHidden?: boolean }) {
  return (
    <div className="flex items-center gap-8 sm:gap-14 px-4 sm:px-7 shrink-0" aria-hidden={ariaHidden}>
      {stores.map((store) => (
        <StoreLogoChip
          key={store.name + (ariaHidden ? "-clone" : "")}
          store={store}
          ariaHidden={ariaHidden}
        />
      ))}
    </div>
  );
}

export default function StoreLogos() {
  const country = getServerCountry();
  const stores = ROSTERS[country.code] ?? ROSTERS.ng;

  return (
    <section className="py-12 sm:py-20 bg-bg">
      <div className="max-w-7xl mx-auto">

        <div className="px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10 text-center">
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-3">
            Searched on Havlo
          </p>
          <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight max-w-xl mx-auto">
            We check the stores you already know{country.code === "ng" ? "" : ` in ${country.name}`}.
          </h2>
        </div>

        {/* Marquee — greyscale loop, fade edges */}
        <div className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 z-10"
            style={{ background: "linear-gradient(to right, rgb(var(--bg-rgb)) 0%, transparent 100%)" }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 z-10"
            style={{ background: "linear-gradient(to left, rgb(var(--bg-rgb)) 0%, transparent 100%)" }}
          />

          <div className="marquee-track flex">
            <Track stores={stores} />
            <Track stores={stores} ariaHidden />
          </div>
        </div>

      </div>
    </section>
  );
}
