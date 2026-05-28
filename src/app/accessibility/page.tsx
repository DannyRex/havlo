/* /accessibility — WCAG 2.1 AA self-declaration + remediation contact.

   Why this page exists:
     The European Accessibility Act (EAA) entered force on 28 June
     2025 and applies to e-commerce-related services in the EU,
     including price comparison + product discovery sites like Havlo.
     EAA requires an accessibility statement that names the standard
     conformed to (WCAG 2.1 AA is the de-facto baseline), any known
     issues, and a remediation contact.

     Even outside the EU, publishing this page is good-faith
     compliance signal for the UK Accessibility Regulations 2018
     (for public-sector-adjacent services), US ADA Title III
     considerations (case law treats commercial websites as places
     of public accommodation in the 9th + 1st Circuits), and the
     Information Regulator's POPIA guidance in South Africa.

   Posture: SELF-DECLARED conformance. We've designed against WCAG
   2.1 AA but have NOT undergone third-party accessibility audit.
   When a third-party audit is commissioned, swap "self-assessed"
   to "audited by [firm], [date]" in the conformance section. */

import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "Our commitment",
    paragraphs: [
      "Havlo is committed to making price comparison accessible to everyone, including users with disabilities. We design the site to work well with screen readers, keyboard-only navigation, voice control, and high-contrast or zoomed visual settings.",
      "This commitment applies across all our markets and devices.",
    ],
  },
  {
    title: "Conformance standard",
    paragraphs: [
      "Havlo aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA, the international standard referenced by the European Accessibility Act, UK Public Sector Bodies Accessibility Regulations, and the US Section 508 update.",
      "This statement is based on self-assessment. We perform internal accessibility reviews on every meaningful UI change and use automated tooling (axe-core) on the staging build before each release. A third-party audit is planned.",
    ],
  },
  {
    title: "What we test",
    paragraphs: [
      "Each release is reviewed across these surfaces:",
    ],
    bullets: [
      "Keyboard-only navigation - every interactive element must be reachable with Tab and operable with Enter/Space.",
      "Screen readers - primary flows tested with VoiceOver (macOS, iOS) and NVDA (Windows). Product cards, filters, and the compare grid have proper ARIA labels.",
      "Color contrast - body text 4.5:1 minimum, large text 3:1 minimum (WCAG AA thresholds). Brand color (#0057FF) passes against the white surface.",
      "Zoom + responsive layout - content remains usable up to 200% browser zoom on a 320px-wide viewport.",
      "Form labels and errors - every input has an associated label; validation errors announce to assistive tech.",
      "Motion preferences - animations respect prefers-reduced-motion; no auto-playing video.",
    ],
  },
  {
    title: "Known limitations",
    paragraphs: [
      "We are aware of the following gaps and are actively working on them:",
    ],
    bullets: [
      "Some retailer product images served via /api/img-proxy lack descriptive alt text - they fall back to the product title, which is meaningful but not always optimal for accessibility.",
      "The masonry layout used on the homepage Trending Deals grid uses CSS columns; some assistive tech announces it as one long list rather than a grid. The /deals page uses CSS Grid (row-by-row), which is the recommended path.",
      "Newsletter and form-validation messaging is in English only across all markets; translated forms are on the roadmap.",
    ],
  },
  {
    title: "Compatibility",
    paragraphs: [
      "Havlo is designed to work with current versions of the following assistive technologies:",
    ],
    bullets: [
      "Screen readers: VoiceOver (macOS 14+, iOS 17+), NVDA 2024.x, JAWS 2024",
      "Browsers: Chrome 120+, Safari 17+, Firefox 121+, Edge 120+",
      "OS magnification + high-contrast modes on macOS, Windows, iOS, and Android",
    ],
  },
  {
    title: "Report a barrier or request alternate access",
    paragraphs: [
      "If you encounter an accessibility barrier on Havlo, or need information presented in an alternative format (large print, plain text, structured data), please email hello@havlo.io with the URL, your browser/AT setup, and a description of the issue.",
      "We aim to acknowledge within 5 working days and to resolve confirmed accessibility issues within 30 days. If a fix requires longer, we will keep you informed and offer the requested content in an alternative format in the meantime.",
    ],
  },
  {
    title: "Enforcement",
    paragraphs: [
      "Users in the European Union may also contact their national accessibility-monitoring authority if we fail to respond satisfactorily. UK users can escalate to the Equality and Human Rights Commission (EHRC). South African users can contact the Information Regulator.",
    ],
  },
  {
    title: "This statement",
    paragraphs: [
      "This accessibility statement was prepared on 28 May 2026 in accordance with the European Accessibility Act and WCAG 2.1 Level AA. It will be reviewed at least annually or after any significant UI change.",
    ],
  },
];

export const metadata: Metadata = {
  title:       "Accessibility · Havlo",
  description: "Havlo's commitment to WCAG 2.1 AA accessibility, known limitations, and how to report a barrier.",
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="Accessibility"
      title="Accessibility statement"
      description="Havlo is designed to be usable by everyone. This page names the standard we conform to, what we test, where we fall short, and how to reach us."
      lastUpdated="28 May 2026"
      sections={sections}
    />
  );
}
