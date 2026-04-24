"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, TrendingDown, Flame } from "lucide-react";
import { deals } from "@/lib/data/deals";

const suggestions = [
  "iPhone 15", "Samsung TV", "Nike shoes", "PlayStation 5", "MacBook Air", "Air Fryer",
];

function formatPrice(amount: number, currency: "NGN" | "USD") {
  if (currency === "USD") {
    return amount >= 1000 ? `$${(amount / 1000).toFixed(1)}K` : `$${amount}`;
  }
  if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 2)}M`;
  if (amount >= 1000) return `₦${Math.round(amount / 1000)}K`;
  return `₦${amount}`;
}

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Pick top deals with discounts, diverse stores, clean titles
  const liveDeals = useMemo(() => {
    const withDiscount = deals.filter((d) => {
      if (d.discountPercent < 15 || d.title.length < 12 || d.title.length > 55) return false;
      // Skip titles truncated by escaped quotes
      if (d.title.includes("\\")) return false;
      // Skip unrealistically cheap USD items (likely wholesale/dropship)
      if (d.currency === "USD" && d.salePrice < 10) return false;
      return true;
    }).sort((a, b) => b.discountPercent - a.discountPercent);

    const seen = new Set<string>();
    const storeCount: Record<string, number> = {};
    const picks: typeof withDiscount = [];
    for (const d of withDiscount) {
      if (picks.length >= 12) break;
      // Max 3 per store for variety
      const sc = storeCount[d.storeId] ?? 0;
      if (sc >= 3) continue;
      const key = d.storeId + d.title.slice(0, 20);
      if (seen.has(key)) continue;
      seen.add(key);
      storeCount[d.storeId] = sc + 1;
      picks.push(d);
    }
    return picks;
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/compare?q=${encodeURIComponent(query.trim())}&mode=similar`);
  };

  return (
    <section className="relative min-h-[94vh] flex items-center overflow-hidden"
             style={{ background: "var(--navy-900)" }}>

      {/* Background texture */}
      <div className="absolute inset-0"
           style={{
             backgroundImage:
               "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,87,255,0.18) 0%, transparent 65%), " +
               "radial-gradient(ellipse 40% 40% at 80% 30%, rgba(0,200,255,0.08) 0%, transparent 50%)",
           }} />

      {/* Subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.025]"
           style={{
             backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
             backgroundSize: "32px 32px",
           }} />

      {/* Drifting orbs */}
      <div className="orb orb-blue w-[500px] h-[500px] -top-32 -left-24 opacity-40 orb-drift" />
      <div className="orb orb-cyan  w-[350px] h-[350px] top-10 right-0 opacity-25 orb-drift"
           style={{ animationDelay: "-6s" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-7 hero-enter"
                 style={{ animationDelay: "0ms" }}>
              <span className="flex h-2 w-2 rounded-full bg-deal-green animate-pulse" />
              <span className="text-sm font-medium text-slate-400 tracking-[-0.01em]">
                Research-backed picks, ranked for you
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-black text-white leading-[1.0] tracking-[-0.04em] mb-6 hero-enter"
                style={{ animationDelay: "80ms" }}>
              Find similar{" "}
              <span className="relative inline-block">
                <span style={{
                  background: "linear-gradient(135deg, #10B981 0%, #00C8FF 60%, #38bdf8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  products for less.
                </span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 8" fill="none">
                  <path d="M0 6 Q75 0 150 4 Q225 8 300 2" stroke="#0057FF" strokeWidth="2.5"
                        strokeLinecap="round" opacity="0.6" />
                </svg>
              </span>
            </h1>

            {/* Sub */}
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed mb-10 max-w-[430px] tracking-[-0.01em] hero-enter"
               style={{ animationDelay: "180ms" }}>
              Start with what you love. We&apos;ll find alternatives you can actually afford.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch}
                  className="relative max-w-[520px] mb-5 group hero-enter"
                  style={{ animationDelay: "280ms" }}>
              <div className="relative flex items-center glass rounded-2xl border border-white/[0.08]
                              hover:border-brand-600/40 focus-within:border-brand-600/60
                              transition-all duration-200"
                   style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                <Search size={17} className="ml-3 sm:ml-5 text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a product or paste a link…"
                  className="flex-1 min-w-0 px-3 sm:px-4 py-4 bg-transparent text-white placeholder-slate-600
                             text-base tracking-[-0.01em] outline-none"
                />
                <button type="submit"
                        className="m-2 btn-primary rounded-xl px-4 sm:px-5 py-2.5 text-sm flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}>
                  <span className="hidden sm:inline">Find dupes</span>
                  <span className="sm:hidden">Go</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 mb-10 hero-enter-fade"
                 style={{ animationDelay: "380ms" }}>
              <span className="text-xs text-slate-600 self-center mr-1">Popular:</span>
              {suggestions.map((s) => (
                <button key={s}
                        onClick={() => router.push(`/compare?q=${encodeURIComponent(s)}&mode=similar`)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-500
                                   hover:text-white hover:bg-white/[0.07] transition-all
                                   border border-white/[0.07] hover:border-white/[0.15] tracking-[-0.01em]">
                  {s}
                </button>
              ))}
            </div>

            {/* Secondary CTA */}
            <div className="flex items-center gap-3 hero-enter"
                 style={{ animationDelay: "460ms" }}>
              <Link href="/compare" className="btn-ghost text-xs sm:text-sm px-4 sm:px-6 py-3 rounded-xl whitespace-nowrap">
                <TrendingDown size={15} />
                Find for less
              </Link>
              <Link href="/deals" className="btn-primary text-xs sm:text-sm px-4 sm:px-6 py-3 rounded-xl whitespace-nowrap">
                Browse deals
              </Link>
            </div>
          </div>

          {/* Right — scrolling deal ticker */}
          <div className="hidden lg:flex flex-col gap-3 hero-enter-right" style={{ animationDelay: "320ms" }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-1 px-0.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-[0.08em]">Live deals</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-deal-green animate-pulse" />
                Fresh prices rolling in
              </span>
            </div>

            {/* Ticker window */}
            <div
              className="relative overflow-hidden rounded-2xl"
              style={{
                height: "360px",
                maskImage: "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
              }}
            >
              {/* Scrolling list — duplicated for seamless loop */}
              <div className="ticker-scroll flex flex-col gap-2.5">
                {[...liveDeals, ...liveDeals].map((card, i) => (
                  <a
                    key={i}
                    href={card.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass rounded-xl border border-white/[0.07] hover:border-brand-600/25
                               transition-colors duration-200 overflow-hidden flex items-stretch flex-shrink-0
                               cursor-pointer"
                  >
                    {/* Left accent bar */}
                    <div className="w-1 flex-shrink-0 bg-gradient-to-b from-brand-600/60 to-cyan-400/60" />

                    {/* Emoji */}
                    <div className="w-14 flex-shrink-0 flex items-center justify-center text-3xl
                                    bg-white/[0.02]">
                      {card.imageEmoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 px-3 py-3 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[13px] font-semibold text-white leading-snug tracking-[-0.02em] truncate">
                          {card.title}
                        </p>
                        {card.isHot && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex-shrink-0"
                                style={{ background: "linear-gradient(135deg, #FF6B35, #FF3333)" }}>
                            <Flame size={8} />
                            Hot
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white tracking-[-0.02em]">{formatPrice(card.salePrice, card.currency)}</span>
                        <span className="text-[11px] text-slate-600 line-through">{formatPrice(card.originalPrice, card.currency)}</span>
                        <span className="ml-auto text-[11px] font-bold text-deal-green">&minus;{card.discountPercent}%</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 tracking-[-0.01em]">on {card.storeName}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Footer note */}
            <p className="text-xs text-slate-600 text-center tracking-[-0.01em]">
              Hover to pause · Direct retailer links · No account needed
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
