import Link from "next/link";
import { Search, SlidersHorizontal, ShoppingBag } from "lucide-react";
import AnimateIn from "@/components/ui/AnimateIn";

const steps = [
  {
    num: "01",
    icon: Search,
    color: "#0057FF",
    title: "Start with what you want",
    description:
      "Search for a product when you know what you need, or head to the deals page when you're open to a smart find.",
    action: { label: "See today's deals ->", href: "/deals" },
  },
  {
    num: "02",
    icon: SlidersHorizontal,
    color: "#00C8FF",
    title: "See the spread fast",
    description:
      "We line up prices in Naira so the cheaper option is obvious, not buried behind extra tabs and mental math.",
    action: null,
  },
  {
    num: "03",
    icon: ShoppingBag,
    color: "#FF6B35",
    title: "Buy from the store you trust",
    description:
      "When you're ready, go straight to the retailer. Havlo does not sit in the middle of your checkout.",
    action: { label: "Compare a product ->", href: "/compare" },
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: "rgb(var(--surface-rgb))" }}>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <AnimateIn variant="slide-left" className="mb-16 max-w-lg">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.1em] mb-4">
            How It Works
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-ink tracking-[-0.04em] leading-[1.05]">
            See the spread.{" "}
            <span style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FFD600 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Pick the best buy.
            </span>
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

              <h3 className="text-lg font-bold text-ink mb-3 tracking-[-0.03em]">{title}</h3>
              <p className="text-sm text-ink-3 leading-relaxed tracking-[-0.01em] mb-5">
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
