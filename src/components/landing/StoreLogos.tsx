"use client";

import Image from "next/image";
import { useState } from "react";
import AnimateIn from "@/components/ui/AnimateIn";

const stores = [
  { name: "Jumia",        domain: "jumia.com.ng",        abbr: "J",  color: "#F97316" },
  { name: "Konga",        domain: "konga.com",            abbr: "K",  color: "#EF4444" },
  { name: "Slot",         domain: "slot.ng",              abbr: "SL", color: "#3B82F6" },
  { name: "3C Hub",       domain: "3chub.com",            abbr: "3C", color: "#8B5CF6" },
  { name: "Jiji",         domain: "jiji.ng",              abbr: "JJ", color: "#10B981" },
  { name: "Payporte",     domain: "payporte.com",         abbr: "PP", color: "#EC4899" },
  { name: "Yaoota",       domain: "yaoota.com",           abbr: "Y",  color: "#F59E0B" },
  { name: "Pointek",      domain: "pointekonline.com",    abbr: "PT", color: "#06B6D4" },
  { name: "Fouani",       domain: "fouani.com",           abbr: "FO", color: "#6366F1" },
  { name: "Cart.ng",      domain: "cart.ng",              abbr: "CT", color: "#14B8A6" },
  { name: "Spar Nigeria", domain: "spar.com.ng",          abbr: "SP", color: "#22C55E" },
];

function StoreLogo({ store }: { store: typeof stores[0] }) {
  const [failed, setFailed] = useState(false);
  const src = `https://logo.clearbit.com/${store.domain}?size=80`;

  return (
    <div className="group glass rounded-xl px-4 py-5 flex flex-col items-center gap-3
                    border border-white/[0.05] hover:border-white/[0.12]
                    transition-all duration-200 hover:-translate-y-0.5 cursor-default">

      {/* Logo */}
      <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
           style={{ background: failed ? store.color : "white" }}>
        {failed ? (
          <span className="text-sm font-black text-white">{store.abbr}</span>
        ) : (
          <Image
            src={src}
            alt={`${store.name} logo`}
            width={48}
            height={48}
            className="w-full h-full object-contain p-1"
            onError={() => setFailed(true)}
            unoptimized
          />
        )}
      </div>

      <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200
                       transition-colors text-center leading-tight tracking-[-0.01em]">
        {store.name}
      </span>
    </div>
  );
}

export default function StoreLogos() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

      <AnimateIn variant="slide-left" className="mb-12">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">
          Price data from
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-[-0.04em]">
          Nigeria&apos;s biggest stores,<br />all in one place.
        </h2>
      </AnimateIn>

      {/* Store grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {stores.map((store, i) => (
          <AnimateIn key={store.domain} variant="scale-in" delay={i * 45}>
            <StoreLogo store={store} />
          </AnimateIn>
        ))}

        {/* Coming soon tile */}
        <AnimateIn variant="scale-in" delay={stores.length * 45}>
        <div className="glass rounded-xl px-4 py-5 flex flex-col items-center gap-3
                        border border-dashed border-white/[0.07]">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center
                          bg-white/[0.03] border border-white/[0.06] text-slate-500 text-lg font-bold">
            +
          </div>
          <span className="text-xs text-slate-600 text-center leading-tight tracking-[-0.01em]">
            More soon
          </span>
        </div>
        </AnimateIn>
      </div>

      {/* Trust strip */}
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2">
        {["Real-time prices", "Verified retailers", "No hidden fees", "Direct store links"].map((t) => (
          <span key={t} className="flex items-center gap-2 text-xs text-slate-500 tracking-[-0.01em]">
            <span className="w-1.5 h-1.5 rounded-full bg-deal-green flex-shrink-0" />
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}
