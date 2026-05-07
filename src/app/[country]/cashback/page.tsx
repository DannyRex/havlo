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
  const description = `Earn cashback when you shop through Havlo. Up to 4% back on Amazon, AliExpress, and more. Coming soon to ${country.name}.`;
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
            When you click through Havlo and buy, the retailer pays us a small
            commission. We share a slice of that with you. Up to 4% back,
            depending on the store.
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
                <strong className="text-ink">Make an account.</strong> Email and
                password, 30 seconds, free.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">2</span>
              <span>
                <strong className="text-ink">Shop through Havlo.</strong> Find
                what you want, click through to the retailer, buy as you
                normally would.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">3</span>
              <span>
                <strong className="text-ink">Cashback tracks itself.</strong>{" "}
                The retailer tells us a sale happened, we credit your account.
                No codes, no extra steps.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">4</span>
              <span>
                <strong className="text-ink">Withdraw.</strong> Once the
                retailer confirms the sale (60 to 90 days for most stores),
                your balance unlocks. Out to your bank or PayPal.
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
            Rates climb as we sign more partners. We pay on the product price,
            not on shipping, taxes, or gift cards.
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
              Withdrawals to your bank or PayPal are free above the minimum
              ({country.code === "ng" ? "₦5,000" : "$25"}). No subscription,
              no monthly cost.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-surface">
            <Shield size={20} className="text-success mb-3" />
            <h3 className="font-bold text-ink text-[15px] mb-2">No bias on results</h3>
            <p className="text-ink-2 text-sm leading-relaxed">
              Higher-cashback retailers don&apos;t get higher rankings. The
              cheapest option still shows first. Cashback is on top, not in
              front.
            </p>
          </div>
        </section>

        {/* Email capture — Phase 2 will replace with auth signup */}
        <section className="mb-12 p-6 sm:p-8 rounded-2xl border border-border-strong bg-surface-2">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-2">
            Get notified when cashback launches.
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-5">
            Accounts and payouts are weeks away. Leave your email and you&apos;ll
            be the first to know when it&apos;s live in {country.name}.
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
                We&apos;re building the accounts, tracking, and payout system
                now. Public launch is weeks out. The waitlist hears first.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Is there a catch?</p>
              <p>
                No. Retailers pay us commission whether we share it or not.
                Sharing it back to you is the better long-term play. You shop,
                you trust, you tell friends.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Why the 60 to 90 day delay?</p>
              <p>
                Retailers wait that long to confirm a sale, mostly to clear the
                return window. We can&apos;t pay you out of money we
                haven&apos;t been paid yet. Your balance sits as pending until
                they confirm.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">What about returns?</p>
              <p>
                If you return the item, the retailer takes back their commission
                and we take back the cashback. It only affects pending balance.
                We never claw back money you&apos;ve already withdrawn.
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
