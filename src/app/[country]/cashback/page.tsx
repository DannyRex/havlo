/* /[country]/cashback — explainer page for the upcoming cashback
   program. Phase 1 (display-only): describes how cashback works,
   shows current rates, captures email signups so we have a
   pre-launch waitlist when Phase 2 (accounts + payouts) ships.

   Architecture:
     - Server-rendered, country-aware metadata
     - Email capture posts to /api/cashback-waitlist (TODO Phase 2)
       For now the form falls back to a mailto with subject so signups
       still reach hello@havlo.io even pre-API
     - Rate table renders from src/lib/cashback.ts as the source of
       truth so adding a new partner store automatically appears here
*/

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Coins, Wallet, Shield } from "lucide-react";
import { COUNTRIES, getCountry } from "@/lib/country";
import { getAllCashbackRates } from "@/lib/cashback";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";
import WaitlistForm from "@/components/cashback/WaitlistForm";

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url = `${SITE_URL}/${country.code}/cashback`;
  const title = `Cashback · Havlo ${country.name}`;
  const description = `Earn cashback when you shop through Havlo. Up to 4% back on Amazon, AliExpress, Konga, and more. Coming soon to ${country.name}.`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("cashback"),
    },
    openGraph: { title, description, url, siteName: "Havlo", type: "website" },
  };
}

export default function CashbackPage({
  params,
}: {
  params: { country: string };
}) {
  const country = getCountry(params.country);
  const rates = getAllCashbackRates();

  return (
    <main className="bg-bg">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        <header className="mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3 inline-flex items-center gap-1.5">
            <Coins size={12} />
            <span>Cashback · Coming Soon</span>
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-ink tracking-[-0.025em] leading-[1.05] mb-5">
            Earn cashback when you shop through Havlo.
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed max-w-2xl">
            Havlo earns commission when you click through to retailers. We&apos;re
            sharing a slice of that with you as cashback on every qualifying
            purchase. Up to 4% back depending on the store.
          </p>
        </header>

        {/* How it works */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-4">
            How it works
          </h2>
          <ol className="space-y-4 text-ink-2 text-[15px] leading-relaxed">
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">1</span>
              <span>
                <strong className="text-ink">Sign up.</strong> Free Havlo account,
                takes 30 seconds. Email + password, no credit card.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">2</span>
              <span>
                <strong className="text-ink">Click through Havlo to shop.</strong>{" "}
                Use Havlo&apos;s search or browse to find what you want, click the
                deal, complete your purchase on the retailer&apos;s site as normal.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">3</span>
              <span>
                <strong className="text-ink">Cashback tracks automatically.</strong>{" "}
                We see the click, the retailer reports the sale, and we credit
                your account. No coupon codes, no extra steps.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">4</span>
              <span>
                <strong className="text-ink">Withdraw your balance.</strong> Once
                the retailer confirms the sale (60-90 days for Amazon and most
                others), your balance becomes payable. Withdraw to bank transfer
                or PayPal.
              </span>
            </li>
          </ol>
        </section>

        {/* Current rates */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-4">
            Cashback rates
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-5">
            Rates may go up over time as we sign more affiliate partners.
            Cashback is paid on the qualifying purchase amount excluding
            shipping, taxes, and gift card purchases.
          </p>
          <ul className="divide-y divide-border border border-border rounded-2xl overflow-hidden">
            {rates.map((r) => (
              <li
                key={r.storeLabel}
                className="flex items-center justify-between gap-4 px-4 py-3.5 bg-surface"
              >
                <span className="text-[15px] text-ink font-medium">
                  {r.storeLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-sm font-bold">
                  <span>{r.percent}% back</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Trust + transparency */}
        <section className="mb-12 grid sm:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl border border-border bg-surface">
            <Wallet size={20} className="text-success mb-3" />
            <h3 className="font-bold text-ink text-[15px] mb-2">No hidden fees</h3>
            <p className="text-ink-2 text-sm leading-relaxed">
              Cashback withdrawal is free to your local bank or PayPal once you
              hit the minimum threshold ({country.code === "ng" ? "₦5,000" : "$25"}).
              No subscription, no monthly cost.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-surface">
            <Shield size={20} className="text-success mb-3" />
            <h3 className="font-bold text-ink text-[15px] mb-2">No bias on results</h3>
            <p className="text-ink-2 text-sm leading-relaxed">
              Higher-cashback retailers don&apos;t rank higher in search.
              Cheapest result still shows first. Cashback is the bonus, not the
              filter.
            </p>
          </div>
        </section>

        {/* Email capture — Phase 2 will replace with auth signup */}
        <section className="mb-12 p-6 sm:p-8 rounded-2xl border border-border-strong bg-surface-2">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-2">
            Get notified when cashback launches.
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-5">
            We&apos;re building the accounts + payout system now. Drop your email
            and we&apos;ll let you know the moment it&apos;s live in {country.name}.
          </p>
          <WaitlistForm country={country.code} />
        </section>

        {/* FAQ-lite */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-4">
            Common questions
          </h2>
          <div className="space-y-5 text-ink-2 text-[15px] leading-relaxed">
            <div>
              <p className="font-semibold text-ink mb-1">When will cashback launch?</p>
              <p>
                We&apos;re building the accounts + tracking + payout system now.
                Targeting public launch within the next few weeks. Waitlist
                members get notified first.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Is there a catch?</p>
              <p>
                No. We earn commission from the retailers whether or not we share
                it. Sharing a slice with you is good business: you come back,
                you trust us, you tell friends. Win-win.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Why is there a 60-90 day delay?</p>
              <p>
                Retailers like Amazon report confirmed sales 60-90 days after
                purchase (to account for returns and refunds). We can&apos;t pay
                you cashback we haven&apos;t been paid yet. Your balance shows as
                pending until the retailer confirms.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">What about returns?</p>
              <p>
                If you return a purchase, the retailer takes back their
                commission, which means we have to take back the cashback. The
                pending balance simply expires. No money is ever owed back to
                Havlo from your account.
              </p>
            </div>
          </div>
        </section>

        {/* CTA back to shopping */}
        <section className="pt-8 border-t border-border flex flex-col sm:flex-row gap-3">
          <Link
            href={`/${country.code}/deals`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Browse deals
            <ArrowRight size={16} />
          </Link>
          <Link
            href={`/${country.code}/compare`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-border-strong text-ink font-semibold text-sm hover:bg-surface-2 transition-colors"
          >
            Find for less
          </Link>
        </section>
      </section>
    </main>
  );
}
