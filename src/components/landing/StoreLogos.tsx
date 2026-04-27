import Image from "next/image";
import { getServerCountry } from "@/lib/country-server";

interface StoreEntry {
  name:       string;
  /** Path under /public/logos. Optional — entries without a logo render
      as a clean text-only chip so we don't ship a broken image. */
  logo?:      string;
  /** White-on-transparent assets get inverted in light mode so they
      read on the white chip background. */
  whiteLogo?: boolean;
}

/* Per-country marquee rosters. Order matters — first chips show first,
   so put the country's flagship retailers up front, cross-border
   (Shein/Temu/AliExpress) at the tail. */
const ROSTERS: Record<string, StoreEntry[]> = {
  ng: [
    { name: "Jumia",      logo: "/logos/jumia.png" },
    { name: "Konga",      logo: "/logos/konga.png" },
    { name: "Slot",       logo: "/logos/slot.png" },
    { name: "3C Hub",     logo: "/logos/threechub.png", whiteLogo: true },
    { name: "Jiji",       logo: "/logos/jiji.png" },
    { name: "Spar",       logo: "/logos/spar.png" },
    { name: "Amazon",     logo: "/logos/amazon.png" },
    { name: "AliExpress", logo: "/logos/aliexpress.png" },
    { name: "ASOS",       logo: "/logos/asos.png" },
    { name: "DHgate",     logo: "/logos/dhgate.png" },
    { name: "SHEIN",      logo: "/logos/shein.png" },
    { name: "Temu",       logo: "/logos/temu.png" },
  ],
  uk: [
    { name: "Amazon UK",  logo: "/logos/amazon.png" },
    { name: "ASOS",       logo: "/logos/asos.png" },
    { name: "Argos" },
    { name: "Currys" },
    { name: "John Lewis" },
    { name: "Boots" },
    { name: "Next" },
    { name: "M&S" },
    { name: "Very" },
    { name: "AO.com" },
    { name: "AliExpress", logo: "/logos/aliexpress.png" },
    { name: "SHEIN",      logo: "/logos/shein.png" },
    { name: "Temu",       logo: "/logos/temu.png" },
    { name: "DHgate",     logo: "/logos/dhgate.png" },
  ],
  us: [
    { name: "Amazon",     logo: "/logos/amazon.png" },
    { name: "Walmart" },
    { name: "Best Buy" },
    { name: "Target" },
    { name: "eBay" },
    { name: "Newegg" },
    { name: "Costco" },
    { name: "Nordstrom" },
    { name: "Wayfair" },
    { name: "Etsy" },
    { name: "AliExpress", logo: "/logos/aliexpress.png" },
    { name: "SHEIN",      logo: "/logos/shein.png" },
    { name: "Temu",       logo: "/logos/temu.png" },
  ],
  de: [
    { name: "Amazon DE",  logo: "/logos/amazon.png" },
    { name: "MediaMarkt" },
    { name: "Saturn" },
    { name: "Zalando" },
    { name: "Otto" },
    { name: "Idealo" },
    { name: "Lidl" },
    { name: "Cyberport" },
    { name: "AliExpress", logo: "/logos/aliexpress.png" },
    { name: "SHEIN",      logo: "/logos/shein.png" },
    { name: "Temu",       logo: "/logos/temu.png" },
  ],
  ae: [
    { name: "Amazon AE",  logo: "/logos/amazon.png" },
    { name: "Noon" },
    { name: "Sharaf DG" },
    { name: "Carrefour" },
    { name: "Lulu" },
    { name: "Centrepoint" },
    { name: "Namshi" },
    { name: "Ounass" },
    { name: "AliExpress", logo: "/logos/aliexpress.png" },
    { name: "SHEIN",      logo: "/logos/shein.png" },
    { name: "Temu",       logo: "/logos/temu.png" },
  ],
  in: [
    { name: "Amazon IN",  logo: "/logos/amazon.png" },
    { name: "Flipkart" },
    { name: "Myntra" },
    { name: "Ajio" },
    { name: "Tata CLiQ" },
    { name: "Nykaa" },
    { name: "Croma" },
    { name: "Reliance Digital" },
    { name: "AliExpress", logo: "/logos/aliexpress.png" },
    { name: "SHEIN",      logo: "/logos/shein.png" },
    { name: "Meesho" },
  ],
  za: [
    { name: "Takealot" },
    { name: "Makro" },
    { name: "Game" },
    { name: "Loot" },
    { name: "Yuppiechef" },
    { name: "Superbalist" },
    { name: "Amazon",     logo: "/logos/amazon.png" },
    { name: "AliExpress", logo: "/logos/aliexpress.png" },
    { name: "SHEIN",      logo: "/logos/shein.png" },
    { name: "Temu",       logo: "/logos/temu.png" },
  ],
};

function Chip({ store, ariaHidden }: { store: StoreEntry; ariaHidden: boolean }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0 group cursor-default">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md overflow-hidden flex items-center justify-center bg-bg border border-border shrink-0">
        {store.logo ? (
          <Image
            src={store.logo}
            alt={ariaHidden ? "" : store.name}
            width={32}
            height={32}
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
