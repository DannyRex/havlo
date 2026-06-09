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
import CountryFlag from "@/components/ui/CountryFlag";
import JsonLd from "@/components/seo/JsonLd";

const SITE_URL = "https://havlo.io";

export const metadata: Metadata = {
  title: "About",
  description:
    "Havlo is an independent price comparison platform helping shoppers in six countries find similar products for less. Local stores plus the cross-border options that ship to you.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About · Havlo",
    description:
      "Independent price comparison across six markets. The story behind Havlo.",
    url: `${SITE_URL}/about`,
    type: "website",
  },
};

/* code uses our internal scheme (uk for Great Britain) - the
   <CountryFlag> component maps to the right CDN slug downstream.
   Germany (de) is intentionally OMITTED from the active coverage
   list while DE launch is deferred (Impressum pending). Re-add the
   { code: "de", name: "Germany" } entry once the German legal
   page ships - same swap to undo as middleware DEFERRED_LAUNCH. */
const COVERAGE = [
  { code: "ng", name: "Nigeria" },
  { code: "uk", name: "United Kingdom" },
  { code: "us", name: "United States" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "in", name: "India" },
  { code: "za", name: "South Africa" },
];

/* Structured data for /about:
   - AboutPage is the semantically correct type for an "about us"
     page; mainEntity links it to the Organization emitted globally in
     the root layout, reinforcing the brand entity for the knowledge
     panel.
   - A short FAQPage covers the two genuinely answerable questions on
     this page. Both answers are grounded in visible content (the
     COVERAGE list; the "free for shoppers / no account required, no
     paywall" copy) rather than invented, and they intentionally don't
     duplicate the monetisation FAQ on /how-we-make-money. */
const aboutJsonLd = [
  {
    "@context":   "https://schema.org",
    "@type":      "AboutPage",
    "@id":        `${SITE_URL}/about`,
    url:          `${SITE_URL}/about`,
    name:         "About Havlo",
    description:  "Havlo is an independent price comparison platform helping shoppers in six countries find similar products for less.",
    inLanguage:   "en",
    isPartOf:     { "@id": `${SITE_URL}#website` },
    mainEntity:   { "@id": `${SITE_URL}#organization` },
  },
  {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    "@id":      `${SITE_URL}/about#faq`,
    mainEntity: [
      {
        "@type":        "Question",
        name:           "Which countries can I use Havlo in?",
        acceptedAnswer: {
          "@type": "Answer",
          text:    `Havlo is live in six countries today: ${COVERAGE.map((c) => c.name).join(", ")}.`,
        },
      },
      {
        "@type":        "Question",
        name:           "Is Havlo free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text:    "Yes. Havlo is free for shoppers, with no account required and no paywall. You search or paste a link and see who has it cheapest.",
        },
      },
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="bg-bg">
      <JsonLd data={aboutJsonLd} />
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
            Havlo is an independent price comparison platform for emerging
            markets. Today we&apos;re live in six
            countries across Africa, Europe, the Middle East, North America,
            and Asia. Paste a link or search anything. We find cheaper
            alternatives across the stores you already know.
          </p>
        </header>

        {/* Story */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            Why we built it
          </h2>
          <div className="space-y-3.5 text-ink-2 text-[15px] leading-relaxed">
            <p>
              Online shopping is messy in every market we cover. The same
              product can vary by 30 to 50% between stores, and the only way
              to find that out is opening five tabs and pricing it yourself.
            </p>
            <p>
              Havlo replaces those five tabs with one search box. Type a
              product, or paste a link, and see who has it cheapest. Local
              stores plus cross-border options. No account required, no
              paywall.
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
                <strong className="text-ink">Search or paste.</strong> Type a
                product name, or paste a link from any major retailer (Konga,
                Argos, Walmart, Amazon, AliExpress, and more).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">2</span>
              <span>
                <strong className="text-ink">Compare in seconds.</strong>{" "}
                Havlo checks prices across local retailers and cross-border
                stores that ship to you.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-ink-3 font-mono shrink-0 mt-0.5">3</span>
              <span>
                <strong className="text-ink">Buy direct.</strong> Click through
                to whoever has the best price. Havlo never sells, takes
                payment, or ships. The transaction is between you and the
                retailer.
              </span>
            </li>
          </ul>
        </section>

        {/* Independence — single paragraph, no monetisation breakdown.
            Peer comparison sites (Dupe, etc.) don't disclose specific
            commission mechanics either; the affiliate disclosure on
            /how-we-make-money is enough for legal compliance. Vague
            principle here, full disclosure on the dedicated page for
            users who want to read more. */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            Why we stay independent
          </h2>
          <div className="space-y-3.5 text-ink-2 text-[15px] leading-relaxed">
            <p>
              Havlo is free for shoppers. Retailers can&apos;t pay to rank
              higher. The cheapest verified option always shows first, no
              matter who pays us or doesn&apos;t. We&apos;re an independent
              business and that&apos;s the rule we built on day one.
            </p>
          </div>
        </section>

        {/* Coverage */}
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            Where we operate
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-4">
            Live in six countries today. Each gets its own catalog of local
            retailers plus the cross-border stores those shoppers actually
            use:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm">
            {COVERAGE.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface-2"
              >
                <CountryFlag code={c.code} size={18} />
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
            Partnerships, retailer integrations, press, or anything else:
            reach us at{" "}
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
