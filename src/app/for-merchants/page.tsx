/* /for-merchants — retailer / brand partnership landing page.

   Audience: retailers, brands, affiliate networks who land on
   havlo.io and want to know "can my store be on Havlo, and if so
   how?" Secondary audience: feed-aggregator platforms (Lengow,
   Channable) who want to understand the data shape we accept.

   Page shape:
     1. Hero — value prop in two lines (we send you buying-intent
        traffic; you give us a product feed)
     2. How it works — three steps (data, vetting, live)
     3. What we accept — supported feed formats + identifiers
     4. Pricing — free for v1, mention performance-based future
     5. FAQ — common objections (data exclusivity, refund policy,
        SLA, control over which products appear)
     6. Contact form — email + company + traffic estimate, posts
        to /api/merchant-inquiry

   Differentiated from /about: /about is "who we are"; this page is
   "how to become a Havlo partner". /about links here in the "Get
   in touch → partnerships" section. */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, ShoppingBag, FileCode, Sparkles,
  CheckCircle2, Mail, Globe2,
} from "lucide-react";
import MerchantInquiryForm from "@/components/merchants/MerchantInquiryForm";

const SITE_URL = "https://havlo.io";

export const metadata: Metadata = {
  title: "For merchants · List your store on Havlo",
  description:
    "Send your products to high-intent shoppers comparing prices across stores. Submit a product feed and reach buyers in seven markets — free during launch.",
  alternates: { canonical: "/for-merchants" },
  openGraph: {
    title: "For merchants · Havlo",
    description:
      "Reach buying-intent shoppers comparing prices across stores. Submit a feed, get listed in seven markets.",
    url: `${SITE_URL}/for-merchants`,
    type: "website",
  },
};

const STEPS = [
  {
    icon: FileCode,
    title: "Send us a product feed",
    body: "Standard Google Shopping XML or CSV. If you already have one for Google Merchant Center, you're done — point us at the same URL.",
  },
  {
    icon: CheckCircle2,
    title: "We vet + ingest",
    body: "We check the feed for completeness and category fit, then index your products into the comparison engine. Most stores go live within 3 business days.",
  },
  {
    icon: Sparkles,
    title: "You start receiving traffic",
    body: "Shoppers who reach a product page see your store as one of the options. When they click through, we send them straight to you. No checkout layer.",
  },
];

const ACCEPTED_FORMATS = [
  "Google Shopping XML feed (the same one you use for Merchant Center)",
  "CSV with at minimum: title, link, price, currency, image_link, availability",
  "Shopify /products.json endpoint (we'll poll it ourselves)",
  "Direct API integration for partners with > 50,000 SKUs",
];

const FAQ = [
  {
    q: "How much does this cost?",
    a: "Free during our launch phase. When we move to a performance-based model later this year, we'll give every existing partner 30 days notice and the option to opt in. No retroactive charges on traffic that already happened.",
  },
  {
    q: "Do I have control over which products appear?",
    a: "Yes. You can exclude individual SKUs or whole categories by adding a `havlo_exclude=true` field to your feed, or by letting us know via partnerships@havlo.io. We honour both.",
  },
  {
    q: "What about returns, customer support, or fraud?",
    a: "Havlo never holds payment or ships goods. Every transaction is between the shopper and you — you handle returns, support, fraud, and warranty exactly the way you do today. We're a discovery + comparison layer, nothing more.",
  },
  {
    q: "How often do prices refresh?",
    a: "We re-fetch feeds twice a week minimum. Higher-volume partners can opt for daily polling. If your inventory moves fast, send us a webhook URL we can hit on price changes.",
  },
  {
    q: "Which markets will my products appear in?",
    a: "Nigeria, UK, US, India, UAE, and South Africa today. Germany is in deferred launch. We country-target based on your store's shipping reach — if you only ship within Nigeria, Havlo only surfaces your products on /ng.",
  },
];

export default function ForMerchantsPage() {
  return (
    <main className="bg-bg">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">

        {/* Hero */}
        <header className="mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3">
            For merchants &amp; brands
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-ink tracking-[-0.025em] leading-[1.05] mb-5">
            Reach shoppers who are ready to buy.
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-lg leading-relaxed">
            Havlo helps shoppers in seven markets find the best price across
            local + cross-border stores. Send us a product feed; we surface
            your products to people actively comparing prices. You handle the
            sale.
          </p>
        </header>

        {/* Quick CTA — anchor to the form below for visitors who already
            know they want to apply. */}
        <div className="mb-14 flex flex-wrap gap-3">
          <a
            href="#apply"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Apply to list
            <ArrowRight size={16} />
          </a>
          <a
            href="mailto:partnerships@havlo.io"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-border-strong text-ink font-semibold text-sm hover:bg-surface-2 transition-colors"
          >
            <Mail size={16} />
            partnerships@havlo.io
          </a>
        </div>

        {/* How it works */}
        <section className="mb-14">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-6">
            How it works
          </h2>
          <ol className="space-y-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-4">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center">
                    <Icon size={16} className="text-ink-2" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-mono text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                    </div>
                    <p className="text-[15px] text-ink-2 leading-relaxed">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* What we accept */}
        <section className="mb-14">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3">
            What we accept
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-4">
            We try to make integration painless. If your store already
            advertises on Google Shopping, you almost certainly already have
            what we need.
          </p>
          <ul className="space-y-2.5">
            {ACCEPTED_FORMATS.map((line) => (
              <li key={line} className="flex gap-2.5 text-[15px] text-ink-2 leading-relaxed">
                <CheckCircle2 size={16} className="text-success shrink-0 mt-1" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Coverage */}
        <section className="mb-14">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3 flex items-center gap-2">
            <Globe2 size={20} />
            Where shoppers will see you
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed">
            Havlo is live in Nigeria, the UK, US, India, UAE, and South Africa.
            We country-target based on your store&apos;s shipping reach, so a
            local-only NG retailer won&apos;t surface in /uk searches and vice
            versa. Cross-border ready stores (Amazon, AliExpress, ASOS) appear
            in every market that imports from them.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-6">
            Common questions
          </h2>
          <div className="space-y-6">
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-base font-semibold text-ink mb-1.5">{q}</h3>
                <p className="text-[15px] text-ink-2 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Apply form */}
        <section id="apply" className="mb-12 scroll-mt-20">
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-3 flex items-center gap-2">
            <ShoppingBag size={20} />
            Apply to list
          </h2>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-6">
            Tell us about your store. We respond within two business days.
            Most partners go live within three after sign-off.
          </p>
          <MerchantInquiryForm />
        </section>

        {/* CTA strip */}
        <section className="pt-8 border-t border-border flex flex-col sm:flex-row gap-3 text-sm">
          <Link
            href="/about"
            className="text-ink-2 hover:text-ink underline-offset-4 hover:underline"
          >
            Read about Havlo
          </Link>
          <span className="text-ink-3 hidden sm:inline">·</span>
          <Link
            href="/contact"
            className="text-ink-2 hover:text-ink underline-offset-4 hover:underline"
          >
            Press or other enquiries
          </Link>
        </section>
      </section>
    </main>
  );
}
