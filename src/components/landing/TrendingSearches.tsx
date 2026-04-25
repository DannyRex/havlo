"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

/* What people are actually searching — real-feeling, not generic taxonomy.
   Mix of brand+model, value claims, and category buys. */
const SEARCHES = [
  { q: "iPhone 15 Pro",        trend: "+128%" },
  { q: "Adidas Samba",         trend: "+94%"  },
  { q: "Galaxy S24 Ultra",     trend: "+82%"  },
  { q: "MacBook Air M3",       trend: "+71%"  },
  { q: "AirPods Pro 2",        trend: "+65%"  },
  { q: "Sony WH-1000XM5",      trend: "+58%"  },
  { q: "PS5 slim",             trend: "+44%"  },
  { q: "55 inch OLED TV",      trend: "+39%"  },
  { q: "Dyson V15",            trend: "+33%"  },
  { q: "Nike Dunk Low",        trend: "+28%"  },
];

export default function TrendingSearches() {
  const router = useRouter();

  const go = (q: string) =>
    router.push(`/compare?q=${encodeURIComponent(q)}&mode=similar`);

  return (
    <section className="py-12 sm:py-16 bg-surface-2/50 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-end justify-between mb-5 sm:mb-6 gap-4">
          <div>
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-1.5">
              Popular this week
            </p>
            <h2 className="text-[22px] sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight">
              What people are searching for
            </h2>
          </div>
        </div>

        {/* Chip rail — full-bleed scroll on mobile */}
        <div className="-mx-4 sm:mx-0">
          <div className="flex gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar px-4 sm:px-0 sm:flex-wrap">
            {SEARCHES.map(({ q, trend }) => (
              <button
                key={q}
                type="button"
                onClick={() => go(q)}
                className="group inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-bg border border-border hover:border-border-strong hover:shadow-card transition-all whitespace-nowrap shrink-0 active:scale-95"
              >
                <span className="text-[13px] sm:text-sm font-medium text-ink">{q}</span>
                <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-success">
                  <ArrowUpRight size={11} strokeWidth={2.5} />
                  {trend}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
