import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "Havlo is not the seller",
    paragraphs: [
      "Havlo is an independent comparison and deal-discovery platform. We help you find offers, but we do not sell the products listed and we do not fulfill orders on behalf of retailers.",
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
      "When you leave Havlo for a third-party site, you do so at your own discretion. Your purchase, payment, delivery, and after-sales support are handled by that retailer, not by Havlo.",
    ],
  },
  {
    title: "No guarantees",
    paragraphs: [
      "Havlo aims to be helpful and current, but we cannot guarantee that every listing, price, or product detail will always be complete, available, or error-free.",
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
      lastUpdated="18 April 2026"
      sections={sections}
    />
  );
}