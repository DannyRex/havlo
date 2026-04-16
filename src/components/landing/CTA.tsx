import Link from "next/link";
import { Zap, ArrowRight, TrendingDown } from "lucide-react";

export default function CTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto relative">

        {/* Card */}
        <div className="relative rounded-3xl overflow-hidden p-12 text-center border border-brand-600/30"
             style={{
               background: "linear-gradient(135deg, #050B18 0%, #0A1428 40%, #0F1E3D 100%)",
               boxShadow: "0 0 80px rgba(0,87,255,0.2), 0 0 0 1px rgba(0,87,255,0.15)",
             }}>

          {/* Orb */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                          w-[500px] h-[300px] rounded-full blur-[100px] pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(0,87,255,0.3) 0%, transparent 70%)" }} />

          {/* Corner decoration */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
               style={{ background: "rgba(0,200,255,0.1)", transform: "translate(30%, -30%)" }} />

          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold
                            border border-brand-600/30 bg-brand-600/10 text-brand-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              Start saving today — it&apos;s free
            </div>

            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
              Ready to pay less{" "}
              <span style={{
                background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                everywhere?
              </span>
            </h2>

            <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10">
              Join thousands of Nigerians who use Dealesty to find the best prices before every purchase.
              No sign-up required.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/deals" className="btn-primary text-base px-8 py-4 rounded-2xl gap-3">
                <Zap size={18} fill="white" />
                Explore Deals
                <ArrowRight size={16} />
              </Link>
              <Link href="/compare" className="btn-ghost text-base px-8 py-4 rounded-2xl gap-3">
                <TrendingDown size={18} />
                Compare Prices
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <span className="flex -space-x-2">
                  {["🧑🏾", "👩🏽", "👨🏿", "👩🏾"].map((e, i) => (
                    <span key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-sm
                                             glass border border-white/10">
                      {e}
                    </span>
                  ))}
                </span>
                50,000+ shoppers
              </span>
              <span>•</span>
              <span>🇳🇬 Made for Nigeria</span>
              <span>•</span>
              <span>✅ Always free</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
