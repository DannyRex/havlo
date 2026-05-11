import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "Using Havlo",
    paragraphs: [
      "Havlo gives you price comparisons, deal discovery, and product shortcuts to third-party retailers. By using the site, you agree to use it lawfully and in a way that does not disrupt the platform or other users.",
    ],
  },
  {
    title: "Prices, products, and availability",
    paragraphs: [
      "We try to keep pricing useful and current, but prices, stock levels, delivery fees, and product details are ultimately controlled by each retailer and can change without notice.",
      "Confirm the final checkout price and any important product details directly on the retailer's website before completing a purchase.",
    ],
  },
  {
    title: "Third-party websites",
    paragraphs: [
      "Havlo links to external retailer websites for convenience. Once you leave Havlo, your transactions and interactions are governed by the retailer's own terms, privacy policy, and customer support process.",
    ],
  },
  {
    title: "Affiliate links and commission",
    paragraphs: [
      "Some links to retailers on Havlo are affiliate links: when you click through and complete a purchase, the retailer pays Havlo a small commission. This is how we keep the site free to use.",
      "The price you pay is the retailer's price. Affiliate links do not change what you pay at checkout. Havlo does not adjust search results, deal rankings, or comparison ordering based on which retailers pay us a commission. Our cheapest-first rule applies regardless of affiliate status.",
      "For more on the commission model and the retailers we currently earn from, see havlo.io/how-we-make-money.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "You may not misuse the site, interfere with its operation, attempt to gain unauthorized access, or use Havlo in a way that could harm the platform, its data, or other users.",
    ],
  },
  {
    title: "Ownership and rights",
    paragraphs: [
      "Havlo's branding, interface, and original site content belong to Havlo unless stated otherwise. Retailer names, logos, and product marks remain the property of their respective owners.",
    ],
  },
  {
    title: "Changes to the service",
    paragraphs: [
      "We may improve, update, pause, or remove parts of Havlo over time. We may also revise these terms when the product or legal requirements change, and the latest version will always be shown on this page.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Terms of Use | Havlo",
  description:
    "Read the terms that apply when you use Havlo to compare prices, browse deals, and visit third-party retailers.",
  alternates: { canonical: "/terms-of-use" },
  openGraph: {
    title: "Terms of Use · Havlo",
    description:
      "Terms that apply when you use Havlo to compare prices and visit third-party retailers.",
    url: "/terms-of-use",
    type: "website",
  },
};

export default function TermsOfUsePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      description="These terms explain how you may use Havlo and what to expect when you click through to third-party retailers from the platform."
      lastUpdated="18 April 2026"
      sections={sections}
    />
  );
}