import Link from "next/link";
import { type Country } from "@/lib/country";

/* Homepage entry point to the /[country]/amazon affiliate landing.
   Amazon is our primary revenue lane (affiliate commission), so this
   card is given real visual weight: surface-2 panel + shadow + a filled
   pill CTA button (not a quiet text arrow). It still leads with the
   honest hook (price-history-checked deals) so it reads as a useful
   shortcut, not a banner ad. */
export default function AmazonPromo({ country }: { country: Country }) {
  return (
    <section className="py-10 sm:py-14 bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href={`/${country.code}/amazon`}
          className="group block rounded-2xl bg-surface-2 shadow-card-lg hover:shadow-card-lg-hover hover:-translate-y-0.5 transition-all duration-300 p-7 sm:p-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-2.5">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                Amazon deals · updated daily
              </span>
              <h2 className="text-2xl sm:text-[28px] font-bold text-ink tracking-[-0.02em] leading-tight">
                Don&apos;t overpay on Amazon
              </h2>
              <p className="text-sm sm:text-base text-ink-2 mt-2 max-w-2xl">
                Every Amazon &apos;deal&apos; comes with its price history, so
                the fake ones have nowhere to hide.
              </p>
            </div>
            {/* Filled pill CTA — the clear, clickable action. The whole
                card is a link; this button-styled span signals where the
                click goes. */}
            <span className="shrink-0 self-center sm:self-auto inline-flex items-center justify-center gap-2 rounded-full bg-ink text-bg px-6 py-3 text-sm font-semibold shadow-sm group-hover:opacity-90 group-hover:gap-3 transition-all">
              Browse Amazon deals
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
