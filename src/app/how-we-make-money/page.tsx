import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    /* Lead with the affiliate disclosure — it's the centerpiece of
       this whole page, and the FTC clear-and-conspicuous standard
       wants the disclosure obvious to anyone who lands here.
       Renamed from "Affiliate disclosure" to "How we earn money"
       so the section heading aligns with the page H1 ("How Havlo
       makes money") and reads as editorial transparency rather
       than legalese. Section content also satisfies the Amazon
       Associates Operating Agreement requirement to include the
       'qualifying purchases' phrase verbatim. */
    title: "How we earn money",
    paragraphs: [
      "Havlo earns small commissions on qualifying purchases through some of our outbound links. This never changes the price you pay. It's the same model used by NerdWallet, Wirecutter, Skyscanner, and most other comparison platforms.",
      "As an Amazon Associate, Havlo earns from qualifying purchases. This applies to clicks that lead to amazon.com, amazon.co.uk, amazon.de, amazon.ae, amazon.in, and other Amazon marketplaces.",
      "Active affiliate relationships: Amazon Associates and Skimlinks (a network covering around 48,000 retailers). Pending approvals: Konga, AliExpress Advanced API, and Awin. New partners get added as their approvals come through. Higher-paying retailers do not rank higher in search; the cheapest option always shows first.",
    ],
  },
  {
    title: "Havlo is not the seller",
    paragraphs: [
      "Havlo is an independent comparison and discovery platform. We do not sell the products listed, do not take payment, do not handle shipping, and do not provide warranty or returns. Every transaction happens directly between you and the retailer whose site you click through to.",
    ],
  },
  {
    title: "How we source listings",
    paragraphs: [
      "Havlo combines public catalog data from multiple sources: official retailer affiliate feeds where available, third-party search APIs (Google Shopping via SerpAPI), and lightweight scrapers for retailers that don't expose a feed. We collect only the structured data needed for price comparison: titles, prices, discount percentages, store name, and product image URLs we link to (we do not host product photos).",
      "We respect retailer robots.txt directives and reasonable rate limits. We honor takedown and exclusion requests within 5 business days. Retailers can email hello@havlo.io to remove or update their listings.",
    ],
  },
  {
    title: "Prices can change quickly",
    paragraphs: [
      "Retailers may change prices, stock levels, delivery charges, or promotional terms at any time. A deal you see on Havlo may look different by the time you reach the retailer's checkout page.",
    ],
  },
  {
    title: "Always do a final check",
    paragraphs: [
      "Before you buy, confirm the final product details, total cost, delivery terms, warranty information, and return policy on the retailer's website. That final retailer page is the source that controls the purchase.",
    ],
  },
  {
    title: "External websites and decisions",
    paragraphs: [
      "When you leave Havlo for a third-party site, you do so at your own discretion. Your purchase, payment, delivery, and after-sales support are handled by that retailer, not by Havlo. We do not endorse any specific retailer beyond surfacing their public listings.",
    ],
  },
  {
    title: "No guarantees",
    paragraphs: [
      "Havlo aims to be helpful and current, but we cannot guarantee that every listing, price, or product detail will always be complete, available, or error-free. Use the information here as a starting point, never as the final source of truth on any transaction.",
    ],
  },
];

export const metadata: Metadata = {
  title: "How Havlo makes money",
  description:
    "How Havlo earns commissions, why our rankings stay independent of who pays us, where our listings come from, and the limits of the information shown on the site.",
  alternates: { canonical: "/how-we-make-money" },
  openGraph: {
    title: "How Havlo makes money",
    description:
      "Affiliate links, no inflated prices, no bias on results — the cheapest store still ranks first.",
    url: "/how-we-make-money",
    type: "website",
  },
};

export default function HowWeMakeMoneyPage() {
  return (
    <LegalPage
      /* Eyebrow is "About Havlo" — frames the page as editorial
         transparency, not legal disclosure. Matches Wirecutter /
         Kayak / Skyscanner branding for the same surface. */
      eyebrow="About Havlo"
      title="How Havlo makes money"
      description="Havlo runs on affiliate commissions and is free for shoppers. This page covers exactly how we earn, why our rankings stay independent of who pays us, where our listings come from, and the limits of what we can guarantee."
      lastUpdated="9 May 2026"
      sections={sections}
    />
  );
}