import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "Using Dealesty",
    paragraphs: [
      "Dealesty gives you price comparisons, deal discovery, and product shortcuts to third-party retailers. By using the site, you agree to use it lawfully and in a way that does not disrupt the platform or other users.",
    ],
  },
  {
    title: "Prices, products, and availability",
    paragraphs: [
      "We work hard to surface useful pricing information, but prices, stock levels, delivery fees, and product details are ultimately controlled by each retailer and can change without notice.",
      "You should confirm the final checkout price and any important product details directly on the retailer's website before completing a purchase.",
    ],
  },
  {
    title: "Third-party websites",
    paragraphs: [
      "Dealesty links to external retailer websites for convenience. Once you leave Dealesty, your transactions and interactions are governed by the retailer's own terms, privacy policy, and customer support process.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "You may not misuse the site, interfere with its operation, attempt to gain unauthorized access, or use Dealesty in a way that could harm the platform, its data, or other users.",
    ],
  },
  {
    title: "Ownership and rights",
    paragraphs: [
      "Dealesty's branding, interface, and original site content belong to Dealesty unless stated otherwise. Retailer names, logos, and product marks remain the property of their respective owners.",
    ],
  },
  {
    title: "Changes to the service",
    paragraphs: [
      "We may improve, update, pause, or remove parts of Dealesty over time. We may also revise these terms when the product or legal requirements change, and the latest version will always be shown on this page.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Terms of Use | Dealesty",
  description:
    "Read the terms that apply when you use Dealesty to compare prices, browse deals, and visit third-party retailers.",
};

export default function TermsOfUsePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      description="These terms explain how you may use Dealesty and what to expect when you click through to third-party retailers from the platform."
      lastUpdated="18 April 2026"
      sections={sections}
    />
  );
}