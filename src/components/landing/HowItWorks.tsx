import Link from "next/link";
import { Search, SlidersHorizontal, ShoppingBag, ArrowRight } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Search,
    color: "#0057FF",
    title: "Search or Browse",
    description:
      "Enter any product name to compare prices, or scroll the deal feed to discover offers across all categories.",
    action: { label: "Browse deals", href: "/deals" },
  },
  {
    num: "02",
    icon: SlidersHorizontal,
    color: "#00C8FF",
    title: "Filter & Compare",
    description:
      "Filter by store, category, or discount percentage. See all prices side-by-side in Nigerian Naira — no hidden costs.",
    action: null,
  },
  {
    num: "03",
    icon: ShoppingBag,
    color: "#FF6B35",
    title: "Buy with Confidence",
    description:
      "Click through to the verified store and buy directly. No middleman, no markup — just the best price we found for you.",
    action: { label: "Compare prices", href: "/compare" },
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: "var(--navy-800)" }}>

      {/* Subtle orb */}
      <div className="orb orb-blue w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold
                          border border-white/10 text-slate-400 mb-4 uppercase tracking-wider">
            How It Works
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white">
            Three steps to your{" "}
            <span style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FFD600 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              best deal
            </span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">

          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-14 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px"
               style={{ background: "linear-gradient(90deg, rgba(0,87,255,0.5) 0%, rgba(0,200,255,0.5) 50%, rgba(255,107,53,0.5) 100%)" }} />

          {steps.map(({ num, icon: Icon, color, title, description, action }) => (
            <div key={num} className="flex flex-col items-center text-center">

              {/* Step circle */}
              <div className="relative mb-6">
                <div className="w-28 h-28 rounded-full flex items-center justify-center"
                     style={{
                       background: `radial-gradient(circle at 30% 30%, ${color}30 0%, ${color}10 100%)`,
                       border: `1px solid ${color}40`,
                       boxShadow: `0 0 40px ${color}20`,
                     }}>
                  <Icon size={36} style={{ color }} />
                </div>
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: color, color: "#fff" }}>
                  {num.slice(-1)}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-[260px] mb-5">{description}</p>

              {action && (
                <Link href={action.href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
                      style={{ color }}>
                  {action.label}
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
