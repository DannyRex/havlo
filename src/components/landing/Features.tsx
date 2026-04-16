import { Zap, BarChart3, Repeat, Bell, ShieldCheck, Smartphone } from "lucide-react";

const features = [
  {
    icon: Zap,
    color: "#0057FF",
    glow: "rgba(0,87,255,0.2)",
    title: "Curated Deal Feed",
    description:
      "Scroll through hundreds of hand-picked deals from Jumia, Konga, Slot and 10+ more stores — filtered by category and ranked by discount.",
    badge: "InstaDeals",
  },
  {
    icon: BarChart3,
    color: "#00C8FF",
    glow: "rgba(0,200,255,0.2)",
    title: "Live Price Comparison",
    description:
      "Search any product and instantly see prices from every major Nigerian retailer side-by-side. Know exactly where to buy.",
    badge: "Price Compare",
  },
  {
    icon: Repeat,
    color: "#FF6B35",
    glow: "rgba(255,107,53,0.2)",
    title: "Smart Alternatives",
    description:
      "Found something too expensive? Dealesty suggests cheaper alternatives with similar specs — save up to 60% without sacrificing quality.",
    badge: "Dupe Finder",
  },
  {
    icon: Bell,
    color: "#FFD600",
    glow: "rgba(255,214,0,0.2)",
    title: "Deal Alerts",
    description:
      "Set price targets and get notified the moment a product drops to your target price across any of our 11+ partner stores.",
    badge: "Coming Soon",
  },
  {
    icon: ShieldCheck,
    color: "#00D68F",
    glow: "rgba(0,214,143,0.2)",
    title: "Verified Sellers Only",
    description:
      "Every deal is from a trusted, verified Nigerian retailer. No fake listings, no shady sellers — just genuine savings.",
    badge: "Trusted",
  },
  {
    icon: Smartphone,
    color: "#8B5CF6",
    glow: "rgba(139,92,246,0.2)",
    title: "Built for Nigeria",
    description:
      "Prices in Naira, Nigerian stores, and tailored to how Nigerians actually shop. No dollar conversions, no irrelevant results.",
    badge: "🇳🇬 Local First",
  },
];

export default function Features() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold
                        border border-white/10 text-slate-400 mb-4 uppercase tracking-wider">
          Why Dealesty
        </div>
        <h2 className="section-title text-4xl sm:text-5xl font-black">
          Everything you need to{" "}
          <span style={{
            background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            shop smarter
          </span>
        </h2>
        <p className="section-subtitle mx-auto mt-4 text-lg">
          Two powerful tools in one platform — a deal discovery feed and a price comparison engine, built specifically for the Nigerian market.
        </p>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map(({ icon: Icon, color, glow, title, description, badge }) => (
          <div key={title}
               className="group relative glass rounded-2xl p-6 border border-white/[0.06]
                          hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-1"
               style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>

            {/* Background glow on hover */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                 style={{ background: `radial-gradient(ellipse at top left, ${glow} 0%, transparent 60%)` }} />

            <div className="relative">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                   style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon size={22} style={{ color }} />
              </div>

              {/* Badge */}
              <span className="absolute top-0 right-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                {badge}
              </span>

              <h3 className="text-base font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
