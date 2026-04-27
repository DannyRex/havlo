import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "Havlo is not the seller",
    paragraphs: [
      "Havlo is an independent comparison and discovery platform. We do not sell the products listed, do not take payment, do not handle shipping, and do not provide warranty or returns. Every transaction happens directly between you and the retailer whose site you click through to.",
      "Where you see Havlo affiliate links, we may earn a small commission from the retailer when a purchase is made. This never changes the price you pay.",
    ],
  },
  {
    title: "How we source listings",
    paragraphs: [
      "Havlo combines public catalog data from multiple sources: official retailer affiliate feeds where available, third-party search APIs (Google Shopping via SerpAPI), and lightweight scrapers for retailers that don't expose a feed. We collect only the structured data needed for price comparison: titles, prices, discount percentages, store name, and product image URLs we link to (we do not host product photos).",
      "We respect retailer robots.txt directives and reasonable rate limits. We honor takedown and exclusion requests within 5 business days — retailers can email hello@havlo.io to remove or update their listings.",
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
  title: "Disclaimer | Havlo",
  description:
    "Understand the limits of the information on Havlo and why final product, price, and checkout details should be verified with each retailer.",
};

export default function DisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Disclaimer"
      description="Havlo helps you compare prices and discover deals, but the final transaction always happens with the retailer. This page explains the limits of the information shown on the site."
      lastUpdated="27 April 2026"
      sections={sections}
    />
  );
}