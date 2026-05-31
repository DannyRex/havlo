/* /[country]/cashback — explainer page for the upcoming cashback
   program. Phase 1 (display-only): describes how cashback works,
   shows current rates, captures email signups so we have a
   pre-launch waitlist when Phase 2 (accounts + payouts) ships.

   Architecture:
     - Server-rendered, country-aware metadata + JSON-LD
     - Email capture posts to /api/cashback-waitlist (TODO Phase 2)
     - Rate table renders from src/lib/cashback.ts as the source of
       truth so adding a new partner store automatically appears here
     - Withdrawal threshold from src/lib/cashback-thresholds.ts so
       UK shoppers see £5, NG sees ₦5,000, etc. — replaces the
       earlier US-dollar-fallback for everyone non-NG.

   Copy refresh (May 2026, pass 2): sharper founder voice across
   the page. Hero H1 reframed from "Money back on the deals you'd
   buy anyway." to "Cashback that lands in your bank account."
   (concrete destination beats behavioural reframe at the top of
   funnel). Subhead closes with "in cash, paid out as a bank
   transfer" — an earlier "Not points. Real money." coda was
   removed after user feedback that the binary contrast read as
   AI. FAQ tightened: Q2 leads with a direct "Yes."
   answer instead of the softer "Honest answer:" preamble; Q3
   closer changed from "the cost of getting more" to "what keeps
   the rates this good" (less cryptic, same trade-off). The earlier
   pass kept PayPal off the page because PayPal-out is restricted
   in NG and most launch markets, bank transfer is the right
   primary rail.

   Copy refresh pass 3 (May 2026): sharper, more confident voice
   without losing the humility. H1 swapped from concrete-destination
   ("Cashback that lands in your bank account.") to concrete-frequency
   ("Money back to your bank, every time you shop."). Frequency is
   the stronger emotional hook for a price-comparison audience that's
   already shopping daily. Subhead leads with "Stores already pay
   us": the word "already" signals an existing dynamic, not a future
   promise, which earns the "coming soon" eyebrow. "How it works"
   step 2 closes with "as you would anyway", the quiet emotional
   hook of the whole pitch (this is found money, not behavior change).
   Trust card 1 kept its enumerated denial ("We don't take a cut,
   charge a withdrawal fee, or require...") after a brief detour into
   anaphora ("No cut. No fee. No minimum."); the long form reads more
   like a founder spelling out their commitment, the short form read
   like a marketing chip. FAQ Q3 now opens with "Two clocks have to
   tick first": picture first, mechanics second. Waitlist H2 swapped cliché "Be first in
   line" for concrete reward "Get your account on day one." JSON-LD
   FAQ block updated to match visible copy verbatim (Google penalises
   divergence). NO em-dashes anywhere in user-facing copy per brand
   voice rule (they read AI-generated). */

import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { ArrowRight, Coins, Wallet, Shield } from "lucide-react";
import { COUNTRIES, getCountry } from "@/lib/country";
import { getAllCashbackRates } from "@/lib/cashback";
import { getWithdrawalMin } from "@/lib/cashback-thresholds";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";
import WaitlistForm from "@/components/cashback/WaitlistForm";
import NewsletterStrip from "@/components/landing/NewsletterStrip";

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  const url     = `${SITE_URL}/${country.code}/cashback`;
  /* Title pattern carries the H1 hook into the SERP. ~50-60 chars
     across all locales (longest is "Havlo South Africa" at 59).
     Pass 3 swap: H1 moved to concrete-frequency ("every time you
     shop"). Title keeps the destination ("paid to your bank") so
     the SERP snippet leads with the keyword shoppers type. */
  const title = `Cashback paid to your bank | Havlo ${country.name}`;
  /* Names the country for local-search relevance, ends with the
     conversion ask (waitlist). Leads with "Money back to your bank"
     mirroring the new H1 voice. Frequency reframe ("every time you
     shop") is the emotional hook for a price-comparison audience
     that's already shopping daily. Surfaces in Google SERPs and
     social-share previews so it counts as a visible surface, not
     just SEO scaffolding. */
  const description = `Get money back to your bank every time you shop through Havlo ${country.name}. Join the waitlist for the launch email and an account on day one.`;
  const ogImage = `${SITE_URL}/og/cashback.png`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildHreflangAlternates("cashback"),
    },
    openGraph: {
      type: "website",
      url,
      siteName: "Havlo",
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Havlo cashback, coming soon to ${country.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default function CashbackPage({
  params,
}: {
  params: { country: string };
}) {
  const country = getCountry(params.country);
  const rates   = getAllCashbackRates();
  const min     = getWithdrawalMin(country.code);

  /* JSON-LD: WebPage + BreadcrumbList + FAQPage. The FAQPage block
     mirrors the four Q&As rendered below so Google's rich-result
     check passes (mismatches get penalised). The BreadcrumbList
     gives Havlo a chance at the breadcrumb sitelink in SERP. */
  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id":   `${SITE_URL}/${country.code}/cashback`,
        url:     `${SITE_URL}/${country.code}/cashback`,
        name:    `Cashback paid to your bank | Havlo ${country.name}`,
        description: `Money back to your bank every time you shop through Havlo ${country.name}. Join the waitlist for the launch email and an account on day one.`,
        inLanguage: "en",
        isPartOf: { "@type": "WebSite", url: SITE_URL, name: "Havlo" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Havlo",        item: SITE_URL },
          { "@type": "ListItem", position: 2, name: country.name,   item: `${SITE_URL}/${country.code}` },
          { "@type": "ListItem", position: 3, name: "Cashback",     item: `${SITE_URL}/${country.code}/cashback` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "When will cashback launch?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Phase 2 is in build now. We're aiming for the coming weeks, but we'd rather take an extra week than ship a broken payout flow on someone's first withdrawal. Waitlist signups get the launch email first.",
            },
          },
          {
            "@type": "Question",
            name: "Is there a catch?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. The catch is timing, not money. Stores hold commissions for weeks while they verify sales and handle returns. We pass that delay through to you instead of fronting the cash and quietly shrinking your rate. Once your balance clears the return window, it's yours. We don't take a cut.",
            },
          },
          {
            "@type": "Question",
            name: "Why the 60 to 90 day delay?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Two clocks have to tick first. The store waits 30 to 60 days for their return window to close, then pays us in their next monthly cycle. We could shorten that by fronting the cash ourselves, but the rates would drop for everyone. The delay is what keeps the rates this high.",
            },
          },
          {
            "@type": "Question",
            name: "What about returns?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Return an item and the cashback for it is reversed in your balance. Partial returns reduce the cashback proportionally. Every change shows up in your transaction history. Nothing happens quietly.",
            },
          },
        ],
      },
    ],
  };

  return (
    <main className="bg-bg">
      <Script
        id="cashback-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        /* .replace escapes "<" so a string value containing
           "</script>" can't break out of the JSON-LD block (XSS).
           < is valid JSON — crawlers parse it unchanged. */
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson).replace(/</g, "\\u003c") }}
      />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className="mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3 inline-flex items-center gap-1.5">
            <Coins size={12} />
            <span>Cashback · coming soon</span>
          </p>
          {/* H1 + subhead aligned with the founder-voice rules: no
              "Get paid to shop" genre cliché in the headline, no
              binary-contrast tic in the body. Pass 3 H1 swap from
              concrete-destination ("Cashback that lands in your bank
              account.") to concrete-frequency ("Money back to your
              bank, every time you shop.") because frequency is the
              stronger emotional hook for a price-comparison audience
              that's already shopping daily. Subhead leads with
              "Stores already pay us": the word "already" signals an
              existing dynamic, not a future promise, which earns the
              "coming soon" eyebrow. */}
          <h1 className="text-3xl sm:text-5xl font-bold text-ink tracking-[-0.025em] leading-[1.05] mb-5">
            Money back to your bank, every time you shop.
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed max-w-2xl">
            Stores already pay us a commission when you shop through Havlo.
            Once cashback launches, most of that comes back to you as a bank
            transfer.
          </p>
        </header>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-4">
            How it works
          </h2>
          <ol className="space-y-4 text-ink-2 text-[15px] leading-relaxed">
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">1</span>
              <span>
                <strong className="text-ink">Sign up.</strong>{" "}
                Drop your email below. Your account opens the day we go live.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">2</span>
              <span>
                <strong className="text-ink">Click through.</strong>{" "}
                Find a deal on Havlo. Click through to the store and buy as
                you would anyway.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">3</span>
              <span>
                <strong className="text-ink">Cashback tracks.</strong>{" "}
                The store confirms your purchase. Your balance updates in
                60 to 90 days.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">4</span>
              <span>
                <strong className="text-ink">Withdraw.</strong>{" "}
                Cash out to your bank once your balance hits {min.display}.
              </span>
            </li>
          </ol>
        </section>

        {/* ── Cashback rates ───────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-4">
            Cashback rates
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-5">
            Rates apply to the qualifying purchase amount, not the order
            total. Taxes, shipping, gift cards, and discounts stacked with a
            separate coupon don&apos;t count. These are launch rates. Most
            will climb as we grow and stores offer us better terms.
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

        {/* ── Trust + transparency ─────────────────────────────── */}
        <section className="mb-12 grid sm:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl border border-border bg-surface">
            <Wallet size={20} className="text-success mb-3" />
            <h3 className="font-bold text-ink text-[15px] mb-2">No hidden fees</h3>
            <p className="text-ink-2 text-sm leading-relaxed">
              Withdraw to your bank once your balance hits {min.display}.
              We don&apos;t take a cut of your balance, charge a withdrawal
              fee, or require a monthly minimum to keep your account active.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-surface">
            <Shield size={20} className="text-success mb-3" />
            <h3 className="font-bold text-ink text-[15px] mb-2">The cheapest still wins</h3>
            <p className="text-ink-2 text-sm leading-relaxed">
              Cashback never changes the search order. The cheapest verified
              offer ranks first, even when the next one down pays us more. We
              wrote that rule down on day one so we can&apos;t quietly change
              our minds later. Cashback is a bonus, not a bribe.
            </p>
          </div>
        </section>

        {/* ── Email capture ────────────────────────────────────── */}
        <section className="mb-12 p-6 sm:p-8 rounded-2xl border border-border-strong bg-surface-2">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-2">
            Get your account on day one.
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-5">
            Cashback ships in the coming weeks. Drop your email and your
            account opens the day we go live in {country.name}.
          </p>
          <WaitlistForm country={country.code} />
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-4">
            Common questions
          </h2>
          <div className="space-y-5 text-ink-2 text-[15px] leading-relaxed">
            <div>
              <p className="font-semibold text-ink mb-1">When will cashback launch?</p>
              <p>
                Phase 2 is in build now. We&apos;re aiming for the coming
                weeks, but we&apos;d rather take an extra week than ship a
                broken payout flow on someone&apos;s first withdrawal.
                Waitlist signups get the launch email first.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Is there a catch?</p>
              <p>
                Yes. The catch is timing, not money. Stores hold commissions
                for weeks while they verify sales and handle returns. We pass
                that delay through to you instead of fronting the cash and
                quietly shrinking your rate. Once your balance clears the
                return window, it&apos;s yours. We don&apos;t take a cut.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">Why the 60 to 90 day delay?</p>
              <p>
                Two clocks have to tick first. The store waits 30 to 60 days
                for their return window to close, then pays us in their next
                monthly cycle. We could shorten that by fronting the cash
                ourselves, but the rates would drop for everyone. The delay
                is what keeps the rates this high.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink mb-1">What about returns?</p>
              <p>
                Return an item and the cashback for it is reversed in your
                balance. Partial returns reduce the cashback proportionally.
                Every change shows up in your transaction history. Nothing
                happens quietly.
              </p>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="pt-8 border-t border-border">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-2">
            Cashback ships soon. The deals are live today.
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-5 max-w-2xl">
            No need to wait for cashback to start saving. Browse today&apos;s
            verified price drops, or paste any product link and we&apos;ll
            find it cheaper across stores.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/${country.code}/deals`}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              See today&apos;s deals
              <ArrowRight size={16} />
            </Link>
            <Link
              href={`/${country.code}/compare`}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-border-strong text-ink font-semibold text-sm hover:bg-surface-2 transition-colors"
            >
              Compare a product
            </Link>
          </div>
        </section>
      </section>
      {/* Global newsletter signup. Added May 2026 launch-readiness
          pass — was previously homepage-only. Cashback waitlisters
          who skip the form below still get a second chance to
          opt into the general newsletter. */}
      <NewsletterStrip />
    </main>
  );
}
