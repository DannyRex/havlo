import Link from "next/link";
import { Search, SlidersHorizontal, ShoppingBag } from "lucide-react";
import AnimateIn from "@/components/ui/AnimateIn";

const steps = [
  {
    num: "01",
    icon: Search,
    color: "#0057FF",
    title: "Search or browse",
    description:
      "Type a product name to compare prices instantly — or scroll the deal feed to find what's on sale right now.",
    action: { label: "Browse deals →", href: "/deals" },
  },
  {
    num: "02",
    icon: SlidersHorizontal,
    color: "#00C8FF",
    title: "Filter & compare",
    description:
      "All prices in Nigerian Naira, side by side. Filter by store, discount tier, or delivery time. No hidden costs.",
    action: null,
  },
  {
    num: "03",
    icon: ShoppingBag,
    color: "#FF6B35",
    title: "Buy with confidence",
    description:
      "Click through directly to the store. No middleman markup, no redirects — just the best price we found.",
    action: { label: "Compare prices →", href: "/compare" },
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: "var(--navy-800)" }}>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <AnimateIn variant="slide-left" className="mb-16 max-w-lg">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-4">
            How It Works
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-[-0.04em] leading-[1.05]">
            From search to{" "}
            <span style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FFD600 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              best deal
            </span>
            {" "}in seconds.
          </h2>
        </AnimateIn>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          {steps.map(({ num, icon: Icon, color, title, description, action }, i) => (
            <AnimateIn key={num} variant="fade-up" delay={i * 120}>
            <div className="relative">

              {/* Step number + icon */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                     style={{
                       background: `${color}12`,
                       border: `1px solid ${color}25`,
                     }}>
                  <Icon size={24} style={{ color }} />
                </div>
                <span className="text-5xl font-black tracking-[-0.05em]"
                      style={{ color: `${color}20` }}>
                  {num}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-3 tracking-[-0.03em]">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed tracking-[-0.01em] mb-5">
                {description}
              </p>

              {action && (
                <Link href={action.href}
                      className="text-sm font-semibold tracking-[-0.01em] transition-colors hover:opacity-80"
                      style={{ color }}>
                  {action.label}
                </Link>
              )}
            </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
