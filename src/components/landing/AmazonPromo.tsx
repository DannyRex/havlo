import Link from "next/link";
import { type Country } from "@/lib/country";

/* Homepage entry point to the /[country]/amazon affiliate landing.
   One on-brand card — promotes our Amazon relationship but leads with
   the honest hook (price-history-checked deals), not a banner ad. */
export default function AmazonPromo({ country }: { country: Country }) {
  return (
    <section className="py-8 sm:py-12 bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href={`/${country.code}/amazon`}
          className="group block rounded-2xl border border-border bg-surface hover:border-ink/40 hover:bg-surface-2 transition-all duration-300 p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-2">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                Amazon deals
              </span>
              <h2 className="text-[22px] sm:text-2xl font-bold text-ink tracking-[-0.02em] leading-tight">
                Save on your next Amazon purchase
              </h2>
              <p className="text-sm sm:text-base text-ink-2 mt-1.5 max-w-2xl">
                Every Amazon price drop we track, checked against its real
                price history.
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:gap-2.5 transition-all">
              Browse Amazon deals
              <span aria-hidden="true">&rarr;</span>
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
