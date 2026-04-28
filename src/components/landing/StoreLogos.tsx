import Image from "next/image";
import { getServerCountry } from "@/lib/country-server";

interface StoreEntry {
  name:       string;
  /** Path under /public/logos. Optional — overrides the domain-based
      lookup when we want a specific bundled asset. */
  logo?:      string;
  /** Retailer's primary domain. Used to fetch a real favicon via
      Google's s2 service when no `logo` is bundled. Free, no API key. */
  domain?:    string;
  /** White-on-transparent assets get inverted in light mode so they
      read on the white chip background. */
  whiteLogo?: boolean;
}

/* Build a Google favicon URL for a store's domain. Returns a 64x64 PNG
   suitable for the marquee chip — visibly larger than a tab favicon
   so logos read clearly even at small chip sizes. */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

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
    { name: "3C Hub",     domain: "3chub.com" },
    { name: "Obiwezy",    domain: "obiwezy.com" },
    { name: "PayPorte",   domain: "payporte.com" },
    { name: "Spar",       domain: "sparnigeria.com" },
    // Cross-border, in NG-shopper preference order
    { name: "Temu",       domain: "temu.com" },
    { name: "AliExpress", domain: "aliexpress.com" },
    { name: "SHEIN",      domain: "shein.com" },
    { name: "Amazon",     domain: "amazon.com" },
    { name: "ASOS",       domain: "asos.com" },
    { name: "DHgate",     domain: "dhgate.com" },
    { name: "eBay",       domain: "ebay.com" },
  ],
  /* uk: roster removed from UI pending affiliate-program approvals. */
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

function Chip({ store, ariaHidden }: { store: StoreEntry; ariaHidden: boolean }) {
  /* Resolve image source: bundled logo wins over domain-derived favicon.
     Falls back to a letter chip if neither is configured. */
  const src = store.logo ?? (store.domain ? faviconUrl(store.domain) : null);

  return (
    <div className="flex items-center gap-2.5 shrink-0 group cursor-default">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md overflow-hidden flex items-center justify-center bg-bg border border-border shrink-0">
        {src ? (
          <Image
            src={src}
            alt={ariaHidden ? "" : store.name}
            width={32}
            height={32}
            unoptimized={!store.logo} /* Google s2 already returns small PNGs; skip Next's optimizer */
            className={`w-5 h-5 sm:w-5 sm:h-5 object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 ${
              store.whiteLogo ? "invert dark:invert-0" : ""
            }`}
          />
        ) : (
          /* Logo-less fallback — first letter in a clean styled chip.
             Looks intentional rather than a broken-image placeholder. */
          <span
            aria-hidden="true"
            className="text-[11px] sm:text-xs font-bold text-ink-3 group-hover:text-ink transition-colors"
          >
            {store.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-sm sm:text-base font-semibold text-ink-3 group-hover:text-ink transition-colors duration-300 whitespace-nowrap tracking-[-0.01em]">
        {store.name}
      </span>
    </div>
  );
}

function Track({ stores, ariaHidden = false }: { stores: StoreEntry[]; ariaHidden?: boolean }) {
  return (
    <div className="flex items-center gap-8 sm:gap-14 px-4 sm:px-7 shrink-0" aria-hidden={ariaHidden}>
      {stores.map((store) => (
        <Chip key={store.name + (ariaHidden ? "-clone" : "")} store={store} ariaHidden={ariaHidden} />
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
