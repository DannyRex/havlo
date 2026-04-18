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

function MarqueeTrack() {
  return (
    <div className="flex items-center gap-10 sm:gap-14 shrink-0">
      {stores.map((store) => (
        <div
          key={store.name}
          className="flex items-center gap-2.5 shrink-0 group cursor-default"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white/10 shrink-0">
            <Image
              src={store.logo}
              alt={store.name}
              width={32}
              height={32}
              className="w-5 h-5 sm:w-6 sm:h-6 object-contain opacity-50 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300"
            />
          </div>
          <span className="text-sm sm:text-base font-semibold text-slate-500 group-hover:text-slate-200 transition-colors duration-300 whitespace-nowrap tracking-[-0.01em]">
            {store.name}
          </span>
        </div>
      ))}
    </div>
  );
}

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
        {/* Fade edges — narrow on mobile, wider on desktop */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-24 lg:w-36 z-10" style={{ background: "linear-gradient(to right, #050B18 0%, rgba(5,11,24,0.6) 50%, transparent 100%)" }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-24 lg:w-36 z-10" style={{ background: "linear-gradient(to left, #050B18 0%, rgba(5,11,24,0.6) 50%, transparent 100%)" }} />

        <div className="flex items-center gap-10 sm:gap-14 animate-marquee w-max">
          <MarqueeTrack />
          <MarqueeTrack />
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
