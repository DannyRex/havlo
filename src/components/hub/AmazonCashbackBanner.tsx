import Link from "next/link";
import { BadgePercent, ArrowRight } from "lucide-react";
import { getCashbackForStore } from "@/lib/cashback";
import { type Country } from "@/lib/country";

/* One prominent cashback banner for the /[country]/amazon page. The 2%
   applies to EVERY Amazon order, so it lives here once (not per card).

   Honest framing: cashback is Phase 1 (waitlist, not yet paying out), so
   the banner reads "coming soon" and routes to the waitlist — same
   posture as CashbackTeaser. Rate is read from the single source of
   truth (cashback.ts) so it can't drift from the /cashback rate table. */
export default function AmazonCashbackBanner({ country }: { country: Country }) {
  const rate = getCashbackForStore("amazon")?.percent ?? 2;

  return (
    <Link
      href={`/${country.code}/cashback`}
      aria-label={`Earn ${rate}% cashback on Amazon orders. Cashback coming soon, join the waitlist`}
      className="group relative block overflow-hidden rounded-2xl border border-success/30 bg-gradient-to-r from-success/10 via-success/5 to-transparent p-5 sm:p-6 mb-8 hover:border-success/50 transition-colors"
    >
      {/* Soft decorative glow, hidden from a11y tree */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-success/10 blur-2xl"
      />

      <div className="relative flex items-center gap-4 sm:gap-5">
        {/* Percent badge */}
        <span className="shrink-0 grid place-items-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-success/15 text-success">
          <BadgePercent size={26} strokeWidth={2} aria-hidden="true" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-success mb-1">
            Cashback &middot; coming soon
          </p>
          <h2 className="text-[18px] sm:text-xl font-bold text-ink tracking-[-0.02em] leading-tight">
            Earn{" "}
            <span className="text-success">{rate}% cashback</span> on every
            Amazon order
          </h2>
          <p className="text-[13px] sm:text-sm text-ink-2 mt-1 max-w-xl">
            Money back on top of the price drops below. Join the waitlist and
            we&apos;ll email you when it goes live.
          </p>
        </div>

        <span className="shrink-0 hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-success group-hover:gap-2.5 transition-all">
          Join the waitlist
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
