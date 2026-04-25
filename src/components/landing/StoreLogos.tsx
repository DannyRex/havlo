import Image from "next/image";

/* `whiteLogo` flags assets that are white-on-transparent (designed for dark UI).
   Those get inverted in light mode so they read on the white chip background. */
const stores = [
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
];

/* Single track of logo cells — rendered twice in the marquee for seamless loop */
function Track({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div className="flex items-center gap-8 sm:gap-14 px-4 sm:px-7 shrink-0" aria-hidden={ariaHidden}>
      {stores.map((store) => (
        <div
          key={store.name + (ariaHidden ? "-clone" : "")}
          className="flex items-center gap-2.5 shrink-0 group cursor-default"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md overflow-hidden flex items-center justify-center bg-bg border border-border shrink-0">
            <Image
              src={store.logo}
              alt={ariaHidden ? "" : store.name}
              width={32}
              height={32}
              className={`w-5 h-5 sm:w-5 sm:h-5 object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 ${
                store.whiteLogo ? "invert dark:invert-0" : ""
              }`}
            />
          </div>
          <span className="text-sm sm:text-base font-semibold text-ink-3 group-hover:text-ink transition-colors duration-300 whitespace-nowrap tracking-[-0.01em]">
            {store.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function StoreLogos() {
  return (
    <section className="py-12 sm:py-20 bg-bg border-t border-border">
      <div className="max-w-7xl mx-auto">

        <div className="px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10 text-center">
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-3">
            Searched on Havlo
          </p>
          <h2 className="text-[22px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight max-w-xl mx-auto">
            We check the stores you already know.
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
            <Track />
            <Track ariaHidden />
          </div>
        </div>

      </div>
    </section>
  );
}
