import Link from "next/link";
import { ArrowRight, TrendingDown } from "lucide-react";
import AnimateIn from "@/components/ui/AnimateIn";

export default function CTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <AnimateIn variant="scale-in" className="max-w-5xl mx-auto">

        <div className="relative rounded-3xl overflow-hidden border border-white/[0.07]"
             style={{
               background: "linear-gradient(135deg, #050B18 0%, #0A1428 50%, #0d1c3a 100%)",
               boxShadow: "0 0 0 1px rgba(0,87,255,0.12), 0 40px 80px rgba(0,0,0,0.4)",
             }}>

          {/* Blue glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                          w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none opacity-40"
               style={{ background: "radial-gradient(circle, rgba(0,87,255,0.5) 0%, transparent 70%)" }} />

          {/* Top-right accent */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none"
               style={{ background: "rgba(0,200,255,0.06)", transform: "translate(30%, -30%)" }} />

          <div className="relative z-10 px-8 sm:px-16 py-16 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-12 items-center">

              {/* Left */}
              <div>
                <div className="inline-flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-deal-green animate-pulse" />
                  <span className="text-sm font-medium text-slate-400 tracking-[-0.01em]">
                    Free to use · Direct retailer links
                  </span>
                </div>

                <h2 className="text-4xl sm:text-5xl font-black text-white tracking-[-0.04em] leading-[1.05] mb-5">
                  Before you buy it,
                  <br />
                  <span style={{
                    background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    price-check it.
                  </span>
                </h2>

                <p className="text-slate-400 text-lg leading-relaxed tracking-[-0.01em] mb-10 max-w-sm">
                  One quick search can show you a better price, a better store, or a better-value alternative. That is worth a few seconds.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/compare" className="btn-primary text-xs sm:text-sm px-5 sm:px-7 py-3.5 rounded-xl gap-2 whitespace-nowrap">
                    <TrendingDown size={15} />
                    Compare Prices
                  </Link>
                  <Link href="/deals" className="btn-ghost text-xs sm:text-sm px-5 sm:px-7 py-3.5 rounded-xl gap-2 whitespace-nowrap">
                    Explore Deals
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>

              {/* Right — stat callouts */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "11+",    label: "Major stores checked\nin one search" },
                  { value: "Direct", label: "Go straight to the\nretailer you trust" },
                  { value: "Naira",  label: "Local pricing that\nmakes quick sense" },
                  { value: "Free",   label: "No account, no paywall,\nno added markup" },
                ].map(({ value, label }, i) => (
                  <AnimateIn key={value} variant="fade-up" delay={200 + i * 80}>
                  <div className="glass-light rounded-2xl p-5 border border-white/[0.06]
                                  hover:border-white/[0.12] hover:scale-[1.02] transition-all duration-200 cursor-default">
                    <p className="text-3xl font-black text-white tracking-[-0.04em] mb-1">{value}</p>
                    <p className="text-xs text-slate-500 leading-relaxed tracking-[-0.01em] whitespace-pre-line">
                      {label}
                    </p>
                  </div>
                  </AnimateIn>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AnimateIn>
    </section>
  );
}
