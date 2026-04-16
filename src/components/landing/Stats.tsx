import AnimateIn from "@/components/ui/AnimateIn";

const stats = [
  { value: "11",     label: "Stores tracked",  sub: "Nigerian retailers" },
  { value: "4,800+", label: "Active deals",     sub: "Updated hourly" },
  { value: "₦180M+", label: "Savings found",    sub: "Across all stores" },
  { value: "12,400", label: "Shoppers helped",  sub: "Since launch" },
];

export default function Stats() {
  return (
    <section className="relative py-0 border-y border-white/[0.05]"
             style={{ background: "var(--navy-800)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.05]">
          {stats.map(({ value, label, sub }, i) => (
            <AnimateIn key={label} variant="fade-up" delay={i * 80} className="py-8 px-6 sm:px-10">
              <span className="text-[32px] font-black tracking-[-0.04em] text-white leading-none mb-1.5 block"
                    style={{
                      background: "linear-gradient(135deg, #ffffff 0%, #7eb8ff 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}>
                {value}
              </span>
              <span className="text-sm font-semibold text-slate-300 tracking-[-0.02em] block">{label}</span>
              <span className="text-xs text-slate-600 mt-0.5 tracking-[-0.01em] block">{sub}</span>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
