/* ──────────────────────────────────────────────────────────────────
   Stats band — single elegant line of numbers, no decorative icons.
   Built around real signals (live counter feel).
   ────────────────────────────────────────────────────────────────── */

const STATS = [
  { value: "18,432",  label: "comparisons today" },
  { value: "₦124M",   label: "saved this month" },
  { value: "12+",     label: "trusted stores" },
];

export default function Stats() {
  return (
    <section className="border-y border-border bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-3 divide-x divide-border">
          {STATS.map(({ value, label }) => (
            <div key={label} className="px-2 py-5 sm:py-7 text-center">
              <div className="text-xl sm:text-3xl font-bold text-ink tracking-[-0.03em] leading-none">
                {value}
              </div>
              <div className="text-[11px] sm:text-[13px] text-ink-3 mt-1.5 sm:mt-2 leading-tight">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
