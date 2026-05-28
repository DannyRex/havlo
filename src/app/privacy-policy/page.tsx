/* /privacy-policy — concrete, plain-English privacy notice that names
   every third-party that touches user data, the legal basis for each,
   and how to exercise rights. Drafted to satisfy GDPR (EU/UK), POPIA
   (South Africa), and CCPA-equivalents. Not legal advice — review
   with counsel before launch in regulated markets. */

import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "What we collect",
    paragraphs: [
      "Site activity: pages you visit, searches you run, deals you click. Used to improve search results and rankings.",
      "Email address: only when you submit a form on Havlo (notify-me, cashback waitlist, contact). Never collected silently.",
      "Technical data: browser type, device, referrer, and your IP address (truncated to a /24 range in our logs so individual users can't be re-identified).",
    ],
  },
  {
    title: "Tools and partners that touch your data",
    paragraphs: [
      "Each third-party below receives the minimum data needed to do its job. Names, regions, and what they see:",
    ],
    bullets: [
      "Google Analytics 4: anonymized page views and events. Loads only after you accept cookies. Data hosted by Google in the EU/US depending on your region.",
      "Skimlinks: rewrites outbound retailer links so we get attribution for clicks. Reads the click destination only. Loads only after you accept cookies.",
      "Vercel: hosts havlo.io. Standard server logs (request method, URL, status code, IP) retained for 30 days for security and debugging.",
      "Supabase: stores form submissions (notify-me, cashback waitlist). Hosted in the EU.",
      "Resend: sends confirmation and notification emails. Receives only your email address and the message we send. Hosted in the US.",
    ],
  },
  {
    title: "Why we collect it (legal basis)",
    paragraphs: [
      "Site activity and server logs: legitimate interest in improving the product and keeping it secure.",
      "Form submissions and emails: your consent, given when you submit the form.",
      "Marketing emails (cashback launch, notify-me alerts): your consent. Reply 'remove' to any email or unsubscribe to opt out.",
      "Analytics and affiliate cookies: your consent via the cookie banner. We don't load GA4 or Skimlinks until you accept.",
    ],
  },
  {
    title: "How long we keep it",
    paragraphs: [
      "Server logs: 30 days.",
      "GA4 events: 14 months (Google's default retention setting).",
      "Form submissions and email: until you ask to be deleted, or until the related feature ships and the list is no longer needed.",
      "Cookies: havlo-country and havlo-cookie-consent each last 1 year. Google's _ga cookie lasts 2 years (only set if you accept cookies).",
    ],
  },
  {
    title: "Your rights under GDPR, POPIA, and similar laws",
    paragraphs: [
      "If you're in the EU or UK, GDPR gives you specific rights over the data we hold about you. South African residents have equivalent rights under POPIA, and similar protections exist in many other jurisdictions. Wherever you live, you can ask us to:",
    ],
    bullets: [
      "Show you what data we have about you.",
      "Delete your email or session data from our records.",
      "Send your data in a portable, machine-readable format.",
      "Stop processing your data for marketing.",
      "Stop processing entirely.",
    ],
  },
  {
    title: "How to exercise your rights",
    paragraphs: [
      "Email hello@havlo.io with the request. We aim to respond within 14 days. If you're in the EU/UK and unhappy with our response, you can also contact your national data protection authority. If you're in South Africa, the Information Regulator.",
    ],
  },
  {
    title: "Information Officer (POPIA) and DSA contact (EU)",
    paragraphs: [
      "South Africa's Protection of Personal Information Act (POPIA) requires us to designate an Information Officer. The EU Digital Services Act requires a named point of contact for users and authorities. Both roles are held by:",
      "Danny Mine, Havlo Founder",
      "Email: hello@havlo.io",
      "We respond to data-subject requests within 14 days. For EU DSA matters (illegal-content notices, authority correspondence), the dedicated page is at /dsa-contact with a 5-working-day target response window.",
      "If a request is sent to the wrong address it will still be honored - we route all privacy correspondence through hello@havlo.io.",
    ],
  },
  {
    title: "Third-party retailers",
    paragraphs: [
      "When you click through to a retailer (Konga, Amazon, AliExpress, ASOS, etc.), you leave Havlo. From that point their privacy policy, payment handling, and delivery terms apply. Havlo does not see your purchase, payment, or delivery details.",
    ],
  },
  {
    title: "International transfers",
    paragraphs: [
      "Your data may be processed in the US (Vercel, Resend), the EU (Supabase, GA4), or in Nigeria (our team). Where required, transfers rely on standard contractual clauses or equivalent safeguards.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      "Havlo is not directed at children under 16. We don't knowingly collect data from anyone under 16. If you believe a child has submitted information through Havlo, email hello@havlo.io and we'll delete it.",
    ],
  },
  {
    title: "Changes to this policy",
    paragraphs: [
      "We update this policy as the product changes. The last-updated date at the top reflects the most recent change. Material changes (new third parties, new categories of data) will be flagged at the top.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Privacy Policy | Havlo",
  description:
    "What data Havlo collects, who we share it with, how long we keep it, and how to exercise your rights under GDPR, POPIA, and similar laws.",
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    title: "Privacy Policy · Havlo",
    description:
      "What data Havlo collects, who we share it with, and how to exercise your rights.",
    url: "/privacy-policy",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="Plain-English notice covering what data we collect when you use Havlo, who else touches it, how long we keep it, and how to exercise your rights."
      lastUpdated="7 May 2026"
      sections={sections}
    />
  );
}
