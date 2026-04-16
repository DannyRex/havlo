import { stores } from "@/lib/data/stores";

export default function StoreLogos() {
  const displayStores = stores.slice(0, 12);

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

      <div className="text-center mb-10">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Price data from
        </p>
        <h2 className="text-2xl font-bold text-white">
          Nigeria&apos;s most trusted stores
        </h2>
      </div>

      {/* Store grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {displayStores.map((store) => (
          <div key={store.id}
               className="group glass rounded-xl px-4 py-4 flex flex-col items-center gap-2
                          border border-white/[0.05] hover:border-white/[0.15]
                          transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">

            {/* Logo circle */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white"
                 style={{ background: store.color }}>
              {store.logo}
            </div>

            <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors text-center leading-tight">
              {store.name}
            </span>

            <span className="text-[10px] text-slate-600">🇳🇬 Nigeria</span>
          </div>
        ))}

        {/* "More coming" tile */}
        <div className="glass rounded-xl px-4 py-4 flex flex-col items-center gap-2
                        border border-dashed border-white/[0.08]">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg
                          bg-white/[0.04] border border-white/[0.06]">
            +
          </div>
          <span className="text-xs text-slate-600 text-center leading-tight">More soon</span>
        </div>
      </div>

      {/* Trust strip */}
      <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-slate-600">
        {["Real-time prices", "Verified sellers", "No hidden fees", "Direct store links"].map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-deal-green" />
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}
