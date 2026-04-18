import Image from "next/image";
import AnimateIn from "@/components/ui/AnimateIn";

const stores = [
  { name: "Jumia",      logo: "/logos/jumia.png" },
  { name: "Konga",      logo: "/logos/konga.png" },
  { name: "Slot",       logo: "/logos/slot.png" },
  { name: "3C Hub",     logo: "/logos/threechub.png" },
  { name: "Jiji",       logo: "/logos/jiji.png" },
  { name: "Spar",       logo: "/logos/spar.png" },
  { name: "Amazon",     logo: "/logos/amazon.png" },
  { name: "AliExpress", logo: "/logos/aliexpress.png" },
  { name: "ASOS",       logo: "/logos/asos.png" },
  { name: "DHgate",     logo: "/logos/dhgate.png" },
  { name: "SHEIN",      logo: "/logos/shein.png" },
  { name: "Temu",       logo: "/logos/temu.png" },
];

/* Duplicate the list so the scroll loops seamlessly */
const marqueeStores = [...stores, ...stores];

export default function StoreLogos() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <AnimateIn variant="slide-left" className="mb-10">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">
          Retailers on Dealesty
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-[-0.04em]">
          From the stores you already<br className="hidden sm:block" /> know and use.
        </h2>
      </AnimateIn>

      {/* Scrolling marquee */}
      <div className="relative overflow-hidden">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 sm:w-48 z-10" style={{ background: "linear-gradient(to right, #050B18 0%, #050B18 10%, rgba(5,11,24,0.85) 30%, rgba(5,11,24,0.4) 60%, transparent 100%)" }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 sm:w-48 z-10" style={{ background: "linear-gradient(to left, #050B18 0%, #050B18 10%, rgba(5,11,24,0.85) 30%, rgba(5,11,24,0.4) 60%, transparent 100%)" }} />

        <div className="flex items-center gap-12 sm:gap-16 animate-marquee w-max">
          {marqueeStores.map((store, i) => (
            <div key={`${store.name}-${i}`} className="flex-shrink-0 flex items-center justify-center h-12">
              <Image
                src={store.logo}
                alt={store.name}
                width={120}
                height={48}
                className={`h-8 sm:h-10 w-auto object-contain grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-300 ${store.name === "3C Hub" ? "max-h-6 sm:max-h-7" : ""}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2">
        {["Prices in Naira", "More stores added regularly", "Direct store links", "Fresh offers added often"].map((t) => (
          <span key={t} className="flex items-center gap-2 text-xs text-slate-500 tracking-[-0.01em]">
            <span className="w-1.5 h-1.5 rounded-full bg-deal-green flex-shrink-0" />
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}
