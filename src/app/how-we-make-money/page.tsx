import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    /* Affiliate disclosure — kept lean. FTC clear-and-conspicuous
       standard is satisfied by the first paragraph; Amazon Associates
       Operating Agreement is satisfied by the verbatim "earns from
       qualifying purchases" sentence. Removed the network-by-network
       breakdown (May 2026) — competitors (Dupe et al.) don't enumerate
       partners and the detail wasn't earning trust, just inviting
       follow-up questions. Higher-paying retailers do not rank higher;
       that principle stays explicit. */
    title: "How we earn money",
    paragraphs: [
      "Some of the outbound links on Havlo are affiliate links. If you click through and buy, we may earn a small commission, at no extra cost to you. This never changes the price you pay.",
      "As an Amazon Associate, Havlo earns from qualifying purchases.",
      "Higher-paying retailers do not rank higher in search results. The cheapest verified option always shows first.",
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
      "Havlo combines public catalog data from a mix of sources to surface comparable prices across the stores you already shop. We collect only the structured information needed to power the comparison: titles, prices, discount percentages, store name, and product image URLs we link to.",
      "We respect retailer robots.txt directives and reasonable rate limits. We honour takedown and exclusion requests within 5 business days. Retailers can email hello@havlo.io to remove or update their listings.",
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
    "How Havlo stays independent and free for shoppers, where our listings come from, and the limits of the information shown on the site.",
  alternates: { canonical: "/how-we-make-money" },
  openGraph: {
    title: "How Havlo makes money",
    description:
      "Havlo is free for shoppers, and retailers can't pay to rank higher. The cheapest verified option always shows first.",
    url: "/how-we-make-money",
    type: "website",
  },
};

export default function HowWeMakeMoneyPage() {
  return (
    <LegalPage
      /* Eyebrow is "About Havlo" — frames the page as editorial
         transparency, not legal disclosure. */
      eyebrow="About Havlo"
      title="How Havlo makes money"
      description="Havlo is free for shoppers, and retailers can't pay to rank higher. This page covers how that works, where our listings come from, and the limits of what we can guarantee."
      lastUpdated="12 May 2026"
      sections={sections}
    />
  );
}