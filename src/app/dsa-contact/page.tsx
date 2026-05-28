/* /dsa-contact — EU Digital Services Act point of contact + notice
   and action mechanism.

   Why this page exists:
     The DSA (effective February 2024) requires every online platform
     accessible to EU users to publish:
       1. A single point of contact for EU authorities (Articles
          11 + 12)
       2. A point of contact for users to report illegal content
       3. A notice and action mechanism (Article 16)
       4. Statement of reasons for content moderation decisions
          (Article 17)
       5. Annual transparency reports (Articles 15 + 24 — only above
          VLOP thresholds, which Havlo is well below)

     Havlo is a marketplace-aggregator, not a content host. We do
     not host user-generated content beyond search queries that the
     user themselves submits to find products. The DSA still applies
     because we serve EU users, but our exposure surface is narrow:
     mostly third-party product titles, images, and prices that we
     ingest from public retailer feeds. If a retailer's listing is
     illegal (counterfeit goods, prohibited items, etc.), we will
     remove the listing on credible report.

   Pairs with: the existing Privacy Policy at /privacy-policy. */

import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "Single point of contact",
    paragraphs: [
      "For all DSA-related correspondence - from EU authorities, users, or third parties - please contact:",
      "Danny Mine (designated DSA contact)",
      "Email: hello@havlo.io",
      "Language for correspondence: English. We will accept correspondence in German, French, Spanish, Italian, and Dutch but will respond in English.",
      "We aim to respond to any DSA notice within 5 working days for substantive matters and within 24 hours to acknowledge receipt.",
    ],
  },
  {
    title: "Report illegal content",
    paragraphs: [
      "Havlo aggregates product listings from third-party retailers. If you believe a listing surfaced on Havlo describes content or goods that are illegal under EU law or your national law, please report it via email to hello@havlo.io. Include in your notice:",
    ],
    bullets: [
      "A description of the suspected illegal content or product, including a URL on havlo.io if applicable.",
      "Your reason for considering it illegal, with a reference to the law that applies.",
      "Your name and email (required so we can communicate the outcome) - your identity will not be shared with the retailer unless legally required.",
      "A statement confirming your good faith belief that the information you provide is accurate.",
    ],
    /* The four bullets above mirror DSA Article 16(2). Critical for
       compliance: the mechanism must accept anonymous reports
       (Recital 50) but can require contact information for
       follow-up. */
  },
  {
    title: "What we do with reports",
    paragraphs: [
      "On receipt of a notice we will:",
    ],
    bullets: [
      "Acknowledge receipt within 24 hours.",
      "Review the notice for completeness - if information is missing we'll request it.",
      "Assess the listing against EU law and any specific national-law claims included.",
      "Take a decision: leave the listing live, remove it, or de-rank it. For removals we keep an audit log of the decision.",
      "Communicate the decision to you and (separately) to the affected retailer where applicable, in line with DSA Article 17.",
    ],
  },
  {
    title: "Content moderation transparency",
    paragraphs: [
      "Havlo does not perform automated content moderation in the DSA sense - we do not use AI to flag user-generated content for removal. Our product-matching engine (which decides whether two listings refer to the same product) does not make moderation decisions; it only groups equivalent products for price comparison.",
      "Listings removed under a DSA notice are recorded in an internal log with the reason, the law cited, and the decision date. Aggregated statistics are reported annually below.",
    ],
  },
  {
    title: "Annual transparency",
    paragraphs: [
      "Havlo is well below the DSA's Very Large Online Platform (VLOP) threshold of 45 million monthly EU users and is therefore not subject to the enhanced VLOP reporting obligations. We will, however, publish a summary annually of:",
    ],
    bullets: [
      "Number of notices received (broken down by claimed legal basis).",
      "Median time to first response.",
      "Number of listings removed.",
      "Number of decisions appealed by retailers.",
    ],
  },
  {
    title: "Out-of-court dispute settlement",
    paragraphs: [
      "If a retailer disagrees with our decision to remove their listing, they may contact us at hello@havlo.io to appeal. If the appeal does not resolve the dispute, the retailer may submit the dispute to a certified out-of-court dispute settlement body in their EU member state, as provided for in DSA Article 21.",
    ],
  },
  {
    title: "This page",
    paragraphs: [
      "This DSA contact page was last reviewed on 28 May 2026. We will update it when EU contact persons, internal escalation routes, or annual transparency figures change.",
    ],
  },
];

export const metadata: Metadata = {
  title:       "DSA Contact · Havlo",
  description: "Havlo's EU Digital Services Act point of contact and how to report illegal content surfaced on the platform.",
};

export default function DSAContactPage() {
  return (
    <LegalPage
      eyebrow="EU Digital Services Act"
      title="DSA contact and content reports"
      description="Single point of contact for EU authorities and users, plus the notice-and-action mechanism for reporting illegal content surfaced on Havlo."
      lastUpdated="28 May 2026"
      sections={sections}
    />
  );
}
