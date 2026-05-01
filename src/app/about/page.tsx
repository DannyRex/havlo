/* /about — founder-voice intro to Havlo. Designed primarily for
   partnership prospects (retailers, affiliate networks) who land on
   havlo.io and want to know "who's behind this and is it real."
   Secondary audience: curious users who want context before trusting
   a new comparison site with their shopping flow.

   Edit notes:
   - Founder bio is intentionally short. Expand with photo / longer
     story when comfortable being public-facing.
   - Coverage list pulls from a static array here rather than the
     COUNTRIES const so this page renders even if the country lib
     evolves. Copy-paste sync if you add a new country.
*/

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const SITE_URL = "https://havlo.io";

export const metadata: Metadata = {
  title: "About",
  description:
    "Havlo is an independent price comparison platform helping shoppers in seven countries find similar products for less. Founded in 2026 by Daniel Ekum.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About · Havlo",
    description:
      "Independent price comparison for emerging markets. The story behind Havlo.",
    url: `${SITE_URL}/about`,
    type: "website",
  },
};

const COVERAGE = [
  { flag: "🇳🇬", name: "Nigeria" },
  { flag: "🇬🇧", name: "United Kingdom" },
  { flag: "🇺🇸", name: "United States" },
  { flag: "🇦🇪", name: "United Arab Emirates" },
  { flag: "🇩🇪", name: "Germany" },
  { flag: "🇮🇳", name: "India" },
  { flag: "🇿🇦", name: "South Africa" },
];

export default function AboutPage() {
  return (
    <main className="bg-bg">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        {/* Hero */}
        <header className="mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3">
            About Havlo
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-ink tracking-[-0.025em] leading-[1.05] mb-5">
            We help shoppers find similar products for less.
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed">
            Havlo is an independent price comparison platform built for
            shoppers in emerging markets, starting in Nigeria and expanding
            across Africa, the Middle East, Europe, and the Americas. Paste
            any product link or search anything, and we surface cheaper
            alternatives across the world&apos;s biggest stores.
          </p>
        </header>

        {/* Story */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            Why we built it
          </h2>
          <div className="space-y-3.5 text-ink-2 text-[15px] leading-relaxed">
            <p>
              Online shopping in emerging markets is fragmented. The same
              product on Jumia, Konga, Slot, and AliExpress can vary by
              30–50%, and there&apos;s no easy way to know without opening
              five tabs and price-checking manually.
            </p>
            <p>
              We started Havlo to fix that. A single search box where you
              can paste any product link or describe what you want, and
              instantly see who has it cheapest, including cross-border
              options. No accounts, no paywalls, no clutter.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            How Havlo works
          </h2>
          <ul className="space-y-3 text-ink-2 text-[15px] leading-relaxed">
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">1</span>
              <span>
                <strong className="text-ink">Search or paste a link.</strong>{" "}
                Type a product name or paste a Jumia / Amazon / AliExpress URL.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">2</span>
              <span>
                <strong className="text-ink">We compare instantly.</strong>{" "}
                Havlo checks prices across local retailers in your country and
                global options that ship to you.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">3</span>
              <span>
                <strong className="text-ink">You buy direct.</strong> Click
                through to the retailer with the best price. Havlo never
                resells. Final purchase, payment, and delivery happen with
                the merchant.
              </span>
            </li>
          </ul>
        </section>

        {/* Independence + monetization — the section partnership prospects
            and skeptical users will look for. Be transparent, plain. */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            How we make money, without bias
          </h2>
          <div className="space-y-3.5 text-ink-2 text-[15px] leading-relaxed">
            <p>
              Havlo is free to use and will stay free. We earn a small
              commission when you click through to a retailer and complete a
              purchase, at no extra cost to you. This is the same model used
              by every major comparison and review site (Skyscanner,
              Wirecutter, NerdWallet).
            </p>
            <p>
              Crucially, retailers cannot pay to bias rankings. The cheapest
              option always shows first. Our incentive aligns with yours: we
              earn more when we genuinely save you money, because better deals
              earn higher click-through.
            </p>
          </div>
        </section>

        {/* Coverage */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            Where we operate
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-4">
            Havlo is live in seven countries, with country-specific catalogs
            of local retailers plus the cross-border stores those shoppers
            actually use:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm">
            {COVERAGE.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border"
              >
                <span aria-hidden="true">{c.flag}</span>
                <span className="text-ink-2">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Get in touch — kept lightweight after removing the founder
            section. Partnership prospects and retailers still need a
            clear contact path; the email + contact form CTAs cover that
            without the personal founder content. */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            Get in touch
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed">
            For partnership inquiries, retailer integrations, press, or
            anything else, reach us at{" "}
            <a
              href="mailto:hello@havlo.io"
              className="text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink"
            >
              hello@havlo.io
            </a>{" "}
            or via{" "}
            <Link
              href="/contact"
              className="text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink"
            >
              the contact form
            </Link>
            .
          </p>
        </section>

        {/* CTA */}
        <section className="pt-8 border-t border-border flex flex-col sm:flex-row gap-3">
          <Link
            href="/compare"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Try Havlo
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/deals"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-border-strong text-ink font-semibold text-sm hover:bg-surface-2 transition-colors"
          >
            Browse deals
          </Link>
        </section>
      </section>
    </main>
  );
}
