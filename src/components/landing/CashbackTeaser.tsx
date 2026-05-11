/* Homepage cashback teaser — sits between TrendingDeals and
   CategoryGrid.

   Why a content block (not a hero strip):
     The earlier hero "Coming soon: cashback" strip duplicated the
     navbar link and pushed the search input further down. Removed in
     c9954c9 per QA r3 C7 ("let the search box breathe").

     Cashback is still the pre-launch waitlist's strongest hook —
     hiding it behind a navbar link means most scrolling visitors
     never see it. This component restores discoverability without
     touching the hero hierarchy:
       • Sits BELOW TrendingDeals (visible to anyone who scrolls past
         the first viewport)
       • Carries its OWN email-capture inline (one-step waitlist
         signup, not "click link → land on /cashback → submit")
       • Doesn't compete with the search box

   Copy is honest about the active rate map (Amazon 2%, AliExpress 5%
   today; more partners as we light up affiliate tags). Don't promise
   stores we haven't actually onboarded — the rest of the brand voice
   leans on "no exaggeration", and over-claiming partners on a
   pre-launch teaser would undercut that. */

import Link from "next/link";
import { Coins } from "lucide-react";
import { getServerCountry } from "@/lib/country-server";
import { getAllCashbackRates } from "@/lib/cashback";
import WaitlistForm from "@/components/cashback/WaitlistForm";

export default function CashbackTeaser() {
  const country = getServerCountry();
  const rates   = getAllCashbackRates();

  return (
    <section
      aria-labelledby="cashback-teaser-heading"
      className="py-12 sm:py-20 bg-surface border-y border-border"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">

          {/* Eyebrow — back to "coming soon" after the earlier "next
              up" rewrite. Clearer about timing, less obscure. */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/30 mb-4">
            <Coins size={12} className="text-success" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-success uppercase tracking-[0.1em]">
              Cashback · coming soon
            </span>
          </div>

          {/* Headline — drops the "Get paid to shop" cashback-genre
              cliché. Same observational beat, no trope. */}
          <h2
            id="cashback-teaser-heading"
            className="text-[24px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight mb-3 sm:mb-4"
          >
            Money back on the deals you&apos;d buy anyway.
          </h2>

          {/* Body — direct value prop in the genre convention, with
              an honest "select stores" qualifier so the claim isn't
              over-promising. Founder-voice differentiation lives on
              /[country]/cashback + in the confirmation email; on a
              teaser the genre wording reads faster.

              Hardcoded "5%" rather than {topRate} so a future rate
              shuffle can't accidentally mis-quote the headline number
              without a deliberate copy edit. */}
          <p className="text-sm sm:text-base text-ink-2 max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed">
            Earn up to 5% cashback when you shop through select stores
            on Havlo.{" "}
            <Link
              href={`/${country.code}/cashback`}
              className="text-ink font-medium underline underline-offset-2 hover:text-ink-2 transition-colors"
            >
              Learn more →
            </Link>
          </p>

          {/* Active rates pills — concrete proof, not marketing copy.
              Pulled from the live rate map so users see exactly which
              stores are wired and at what rate. Empty state shouldn't
              happen (we always have at least one active rate) but
              defended against just in case. */}
          {rates.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-7 sm:mb-8">
              {rates.map((r) => (
                <span
                  key={r.storeLabel}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg border border-border text-[12px]"
                >
                  <span className="text-ink font-medium">{r.storeLabel}</span>
                  <span className="text-success font-semibold tabular-nums">{r.percent}%</span>
                </span>
              ))}
              <span className="text-[12px] text-ink-3">
                more soon
              </span>
            </div>
          )}

          {/* Inline waitlist form. Source tag distinguishes these
              signups from the /cashback explainer page so we can
              measure how much of the waitlist comes from this
              surface vs. the dedicated page. */}
          <div className="w-full max-w-md">
            <WaitlistForm country={country.code} source="homepage-cashback" compact />
            <p className="mt-3 text-[11px] text-ink-3 leading-relaxed">
              One email when it goes live. Nothing else.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
