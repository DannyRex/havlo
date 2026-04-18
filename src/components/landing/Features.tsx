import { Zap, BarChart3, Repeat, Bell, ShieldCheck, Smartphone } from "lucide-react";
import AnimateIn from "@/components/ui/AnimateIn";

const features = [
  {
    icon: Zap,
    color: "#0057FF",
    glow: "rgba(0,87,255,0.15)",
    title: "Deals worth your time",
    description:
      "Skip the noise. We surface standout offers from major stores and make it easy to sort by discount, category, or what is moving right now.",
    badge: "Live feed",
  },
  {
    icon: BarChart3,
    color: "#00C8FF",
    glow: "rgba(0,200,255,0.12)",
    title: "Compare in one glance",
    description:
      "Search once and line up prices side by side. No ten-tab routine. No guessing whether you really found the best offer.",
    badge: "Side by side",
  },
  {
    icon: Repeat,
    color: "#FF6B35",
    glow: "rgba(255,107,53,0.12)",
    title: "Better-value alternatives",
    description:
      "If the exact item feels overpriced, we point you to lower-priced options that still make sense for what you need.",
    badge: "Smart switch",
  },
  {
    icon: Bell,
    color: "#FFD600",
    glow: "rgba(255,214,0,0.12)",
    title: "Price drop alerts",
    description:
      "Set your target and let the deal come to you. When a store hits your number, you'll know without checking every day.",
    badge: "Coming Soon",
  },
  {
    icon: ShieldCheck,
    color: "#00D68F",
    glow: "rgba(0,214,143,0.12)",
    title: "Retailers you recognize",
    description:
      "We focus on stores Nigerians already know, so you spend less time second-guessing and more time buying confidently.",
    badge: "Trusted",
  },
  {
    icon: Smartphone,
    color: "#8B5CF6",
    glow: "rgba(139,92,246,0.12)",
    title: "Built for shopping here",
    description:
      "Naira pricing, familiar retailers, and results shaped around how people actually shop in Nigeria.",
    badge: "Local first",
  },
];

export default function Features() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

      {/* Header */}
      <AnimateIn variant="fade-up" className="mb-16 max-w-xl">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-4">
          Why Dealesty
        </p>
        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-[-0.04em] leading-[1.05]">
          Know when it's{" "}
          <span style={{
            background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            actually a deal.
          </span>
        </h2>
        <p className="text-slate-400 text-lg mt-4 leading-relaxed tracking-[-0.01em]">
          Browse when you want inspiration. Compare fast when you already know what you want.
        </p>
      </AnimateIn>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(({ icon: Icon, color, glow, title, description, badge }, i) => (
          <AnimateIn key={title} variant="fade-up" delay={i * 60}>
          <div className="group relative glass rounded-2xl p-6 border border-white/[0.05]
                          hover:border-white/[0.10] hover:-translate-y-1
                          transition-all duration-300 h-full"
               style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.15)" }}>

            {/* Background glow on hover */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                 style={{ background: `radial-gradient(ellipse at top left, ${glow} 0%, transparent 65%)` }} />

            <div className="relative">
              {/* Icon + badge row */}
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-[-0.01em]"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}20` }}>
                  {badge}
                </span>
              </div>

              <h3 className="text-[15px] font-bold text-white mb-2 tracking-[-0.02em]">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed tracking-[-0.01em]">{description}</p>
            </div>
          </div>
          </AnimateIn>
        ))}
      </div>
    </section>
  );
}
