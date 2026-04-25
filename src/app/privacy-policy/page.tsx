import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "What we may collect",
    paragraphs: [
      "When you use Havlo, we may receive information such as the searches you run, the pages you visit, the deals you click, and basic technical details about your browser, device, or connection.",
      "Like most websites, some of this information may come through standard logs, cookies, or similar technologies that help the site work properly and show us what people find useful.",
    ],
  },
  {
    title: "How we use that information",
    paragraphs: [
      "We use site activity and technical information to operate Havlo, improve the quality of search results, understand which parts of the product are helping people most, and keep the service secure and reliable.",
    ],
    bullets: [
      "To return relevant price comparisons and deal results.",
      "To understand usage trends and improve the experience over time.",
      "To diagnose performance or security issues on the site.",
    ],
  },
  {
    title: "What Havlo does not handle",
    paragraphs: [
      "Havlo is a discovery and comparison platform. We do not sell products directly on this website, and we do not process your payment card details during your purchase journey.",
    ],
  },
  {
    title: "Third-party retailers",
    paragraphs: [
      "When you click through to a retailer, you leave Havlo and continue on that retailer's website. Their privacy practices, payment handling, delivery terms, and return policies apply from that point onward.",
    ],
  },
  {
    title: "Policy updates",
    paragraphs: [
      "We may update this policy as Havlo grows or the service changes. When we do, we will update the date on this page so you can see the latest version at a glance.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Privacy Policy | Havlo",
  description:
    "Read how Havlo handles site activity, search usage, and basic technical information when you use the platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="Havlo exists to help you compare prices and discover better-value offers. This page explains what information we may collect when you use the site and how we handle it."
      lastUpdated="18 April 2026"
      sections={sections}
    />
  );
}