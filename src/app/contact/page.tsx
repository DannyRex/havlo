/* /contact — small Formspree-backed contact form.
   Server component for metadata + SEO; the actual form is a client
   component so we can show inline loading/success/error states without
   a full page reload. Endpoint is read from NEXT_PUBLIC_CONTACT_FORM_URL
   (e.g. a https://formspree.io/f/xxxx URL). When unset, the form falls
   back to a mailto: link so dev / preview deploys still do something
   useful instead of failing silently. */

import type { Metadata } from "next";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions, partnerships, or feedback? Send us a note — we read every message.",
  openGraph: {
    title: "Contact · Havlo",
    description: "Get in touch — questions, partnerships, feedback.",
    url: "/contact",
    type: "website",
  },
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const endpoint = process.env.NEXT_PUBLIC_CONTACT_FORM_URL ?? "";

  return (
    <main className="bg-bg">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <header className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 mb-3">
            Contact
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-tight mb-3">
            Get in touch.
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-base leading-relaxed">
            Questions, feedback, partnership ideas, or a store you want us to
            cover. Drop a note below and we&apos;ll reply within 1–2 business days.
          </p>
        </header>

        <ContactForm endpoint={endpoint} />

        <p className="text-xs text-ink-3 mt-8">
          Prefer email? Reach us at{" "}
          <a
            href="mailto:hello@havlo.io"
            className="text-ink-2 hover:text-ink underline underline-offset-4"
          >
            hello@havlo.io
          </a>
          .
        </p>
      </section>
    </main>
  );
}
