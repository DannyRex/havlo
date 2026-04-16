const stats = [
  { value: "11+",    label: "Nigerian Stores",    icon: "🏪" },
  { value: "10K+",   label: "Active Deals",        icon: "⚡" },
  { value: "₦2B+",   label: "Savings Tracked",     icon: "💰" },
  { value: "50K+",   label: "Happy Shoppers",       icon: "🇳🇬" },
];

export default function Stats() {
  return (
    <section className="relative py-12 border-y border-white/[0.05]"
             style={{ background: "var(--navy-800)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-white/[0.06]">
          {stats.map(({ value, label, icon }) => (
            <div key={label} className="flex flex-col items-center text-center py-2 px-6">
              <span className="text-2xl mb-2">{icon}</span>
              <span className="text-3xl font-black text-white tracking-tight"
                    style={{ background: "linear-gradient(135deg, #fff 0%, #93c5fd 100%)",
                             WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {value}
              </span>
              <span className="text-sm text-slate-500 mt-1">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
