"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Zap, TrendingDown, Sparkles } from "lucide-react";

const suggestions = [
  "iPhone 15", "Samsung TV", "Nike shoes", "PlayStation 5", "MacBook Air", "Air Fryer",
];

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/compare?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden"
             style={{ background: "var(--navy-900)" }}>

      {/* Orb decorations */}
      <div className="orb orb-blue w-[600px] h-[600px] -top-40 -left-20 opacity-60" />
      <div className="orb orb-cyan  w-[400px] h-[400px] top-20 right-0 opacity-40" />
      <div className="orb orb-orange w-[300px] h-[300px] bottom-0 left-1/3 opacity-30" />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
           style={{
             backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
             backgroundSize: "64px 64px",
           }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <div className="max-w-4xl mx-auto text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8
                          border border-brand-600/30 bg-brand-600/10 text-brand-400 animate-fade-in">
            <Zap size={13} fill="currentColor" />
            Nigeria&apos;s #1 Deal Discovery Platform
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-deal-orange text-white">NEW</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6 animate-slide-up">
            Shop Smarter.{" "}
            <span className="relative inline-block">
              <span style={{
                background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 60%, #38bdf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Save More.
              </span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 8" fill="none">
                <path d="M0 6 Q75 0 150 4 Q225 8 300 2" stroke="#0057FF" strokeWidth="2.5"
                      strokeLinecap="round" opacity="0.6" />
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Discover curated deals from <span className="text-white font-medium">11+ Nigerian stores</span>.
            Compare prices in seconds. Find smarter alternatives. All in one place.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch}
                className="relative max-w-2xl mx-auto mb-6 group">
            <div className="absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                 style={{ background: "rgba(0,87,255,0.2)" }} />
            <div className="relative flex items-center glass rounded-2xl border border-white/10
                            hover:border-brand-600/40 focus-within:border-brand-600
                            transition-all duration-200"
                 style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
              <Search size={18} className="ml-5 text-slate-500 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products to compare prices…"
                className="flex-1 px-4 py-4 bg-transparent text-white placeholder-slate-500 text-base outline-none"
              />
              <button type="submit"
                      className="m-2 btn-primary rounded-xl px-5 py-2.5 text-sm gap-2 flex-shrink-0">
                Compare
                <ArrowRight size={15} />
              </button>
            </div>
          </form>

          {/* Suggestion chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {suggestions.map((s) => (
              <button key={s}
                      onClick={() => router.push(`/compare?q=${encodeURIComponent(s)}`)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-400
                                 hover:text-white hover:bg-white/[0.08] transition-all duration-150
                                 border border-white/[0.06] hover:border-white/[0.15]">
                {s}
              </button>
            ))}
          </div>

          {/* Dual CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/deals" className="btn-primary text-base px-8 py-4 rounded-2xl gap-3">
              <Zap size={18} fill="white" />
              Browse All Deals
            </Link>
            <Link href="/compare" className="btn-ghost text-base px-8 py-4 rounded-2xl gap-3">
              <TrendingDown size={18} />
              Compare Prices
            </Link>
          </div>
        </div>

        {/* Floating deal card preview */}
        <div className="mt-20 max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { emoji: "📱", title: "iPhone 15", original: "₦980K", sale: "₦749K", off: "24% OFF", store: "Jumia", grad: "from-blue-950 to-indigo-950", hot: true },
            { emoji: "🎮", title: "PlayStation 5", original: "₦620K", sale: "₦499K", off: "20% OFF", store: "3C Hub", grad: "from-blue-950 to-slate-900", hot: true },
            { emoji: "💻", title: "MacBook Air M2", original: "₦1.35M", sale: "₦1.06M", off: "22% OFF", store: "3C Hub", grad: "from-slate-900 to-navy-800", hot: false },
          ].map((card, i) => (
            <div key={i}
                 className={`glass rounded-2xl p-5 border border-white/[0.06] hover:border-brand-600/30
                             transition-all duration-300 hover:-translate-y-1 cursor-pointer
                             ${i === 1 ? "sm:scale-105 sm:shadow-brand-glow" : ""}`}
                 style={{ animationDelay: `${i * 0.15}s` }}>
              <div className={`w-full h-28 rounded-xl bg-gradient-to-br ${card.grad}
                               flex items-center justify-center text-5xl mb-4 border border-white/[0.04]`}>
                {card.emoji}
              </div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-white">{card.title}</p>
                {card.hot && <span className="badge-hot flex-shrink-0">🔥 Hot</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{card.sale}</span>
                <span className="text-xs text-slate-500 line-through">{card.original}</span>
                <span className="badge-discount ml-auto">{card.off}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Sparkles size={11} className="text-brand-400" />
                <span className="text-xs text-slate-500">on {card.store}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="mt-16 flex flex-col items-center gap-2 opacity-40">
          <span className="text-xs text-slate-500 tracking-widest uppercase">Scroll to explore</span>
          <div className="w-5 h-8 rounded-full border border-slate-600 flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-slate-500 animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
}
