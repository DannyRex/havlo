import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

/* Terms of Use — the master agreement for using Havlo.

   The Accessibility Statement lives here as the "Accessibility", "Accessibility:
   known limitations", and "Reporting an accessibility barrier" sections (merged
   in June 2026, previously a standalone /accessibility page which now permanently
   redirects to /terms-of-use#accessibility). LegalPage slugs section titles into
   anchor ids, so the "Accessibility" section is reachable at #accessibility.

   Accessibility conformance is SELF-DECLARED (WCAG 2.1 AA, no third-party audit
   yet). When an audit is commissioned, change "a self-assessment, not yet a
   third-party audit" to "audited by [firm], [date]" in the Accessibility section.

   NOTE FOR REVIEW: governing law is stated as Nigeria (where Havlo is operated)
   and the liability cap is illustrative. Have a qualified lawyer in the operating
   jurisdiction confirm both before relying on this. No em-dashes (AI-tell). */

const sections = [
  {
    title: "About these terms",
    paragraphs: [
      "These Terms of Use are an agreement between you and Havlo. In these terms, Havlo is also called we or us. They govern your use of the Havlo website and its features, and they include our accessibility statement, which is set out further down this page.",
      "By using Havlo, you confirm that you have read and accepted these terms. If you do not agree with them, please do not use the site. You must be old enough to form a binding contract in the country where you live; if you are below that age, use Havlo only with the involvement of a parent or guardian.",
    ],
  },
  {
    title: "What Havlo is, and what it is not",
    paragraphs: [
      "Havlo is a price comparison and deal discovery service. We gather product listings and prices from third-party retailers, organise them so you can compare, show price history and deals, and link you out to the retailer to buy.",
      "Havlo is not a shop or a marketplace. We do not sell products, hold your payment, run checkout, or ship anything. Every purchase you make is a contract between you and the retailer you buy from. We are not a party to that contract and have no control over the retailer's products, stock, pricing, fulfilment, returns, warranties, or customer service.",
    ],
  },
  {
    title: "Prices, products, and availability",
    paragraphs: [
      "Prices, stock levels, delivery fees, specifications, and other product details are set and controlled by each retailer and can change or sell out at any time, sometimes before we can update them. We work to keep this information useful and current, but we do not guarantee that it is accurate, complete, or available, and we present it on an as-is basis.",
      "Any currency conversions, savings figures, lowest-price indicators, and landed-cost or import estimates are provided for guidance only and may differ from the amount you are actually charged. Always confirm the final price, currency, taxes, shipping, and any important product details on the retailer's own website before you complete a purchase.",
    ],
  },
  {
    title: "Third-party retailers and websites",
    paragraphs: [
      "When you click through from Havlo, you leave our site and enter a retailer's own website, which we do not operate or control. From that point your activity is governed by the retailer's terms, privacy policy, and support process, not ours.",
      "We are not responsible for third-party websites, their content, their products or services, or any loss that arises from your dealings with them. Listing a retailer on Havlo is not an endorsement or a guarantee of that retailer.",
    ],
  },
  {
    title: "Affiliate links and how we make money",
    paragraphs: [
      "Some links to retailers on Havlo are affiliate links: when you click through and complete a purchase, the retailer may pay Havlo a small commission. This is one of the ways we keep Havlo free to use.",
      "The price you pay is the retailer's price. Affiliate links never change what you pay at checkout. We do not adjust search results, deal rankings, or comparison ordering based on which retailers pay us. Our cheapest-first rule applies regardless of affiliate status.",
      "For more on the commission model and the retailers we currently earn from, see havlo.io/how-we-make-money.",
    ],
  },
  {
    title: "Things you submit: searches, links, uploads, and votes",
    paragraphs: [
      "Some features let you give us information: a search term, a product link you paste in to compare, an image you upload to find a product, a barcode you scan, an email address for alerts or our newsletter, or a vote on our public roadmap.",
      "You keep ownership of what you submit. You grant Havlo a non-exclusive, worldwide, royalty-free licence to use, store, and process that material for the purpose of providing and improving the service. Do not submit anything unlawful or infringing, or anything that contains other people's sensitive personal information. How we handle this data is explained in our Privacy Policy.",
    ],
  },
  {
    title: "Emails and notifications",
    paragraphs: [
      "If you set a price alert, join a waitlist, or subscribe to our newsletter, you are asking us to send you the related emails. Price-drop alerts go out when a product you are watching falls in price. You can unsubscribe from marketing and alert emails at any time using the link in any such email. We may still send essential service messages, for example to confirm or end a subscription.",
    ],
  },
  {
    title: "Cashback, Ask Havlo, and other new features",
    paragraphs: [
      "Havlo is still being built. Some features are live, some are on a waitlist, and some are still on our roadmap, including cashback, AI-assisted shopping (Ask Havlo), group buying, wishlists, and creator storefronts.",
      "Joining a waitlist or expressing interest does not create any entitlement, account, or guarantee that a feature will launch, launch in your market, or work in a particular way. When a feature does launch it may carry its own additional terms, which apply alongside these. We may add, change, pause, or withdraw any feature at any time.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "You agree to use Havlo lawfully and not to:",
    ],
    bullets: [
      "interfere with, disrupt, overload, or attempt to gain unauthorised access to the site, its systems, or its data;",
      "scrape, harvest, copy, or systematically extract Havlo's compiled prices, deal data, or other content, by bot, script, or otherwise, except where we expressly allow it;",
      "reverse engineer the service, or resell or build a competing product or dataset from it;",
      "remove, obscure, or interfere with affiliate links, attribution, or any notices on the site; or",
      "use Havlo to break the law or to infringe anyone's rights.",
    ],
  },
  {
    title: "Intellectual property",
    paragraphs: [
      "Havlo's branding, interface, original written content, and the way we compile and present prices belong to Havlo unless stated otherwise. We give you a limited, personal, non-transferable licence to use the site for your own non-commercial price comparison. Everything not expressly granted is reserved.",
      "Retailer names, logos, product images, and product marks remain the property of their respective owners and are shown for identification and comparison only.",
    ],
  },
  {
    title: "No warranties",
    paragraphs: [
      "Havlo and everything on it are provided on an as-is and as-available basis, without warranties of any kind, express or implied, to the fullest extent the law allows. We do not warrant that the site will be uninterrupted, error-free, or secure, or that prices, availability, or other information are accurate or complete.",
      "Nothing on Havlo is financial, professional, or purchasing advice. Deals, savings figures, and best-price indicators are informational, and any decision you make based on them is your own.",
    ],
  },
  {
    title: "Limitation of liability",
    paragraphs: [
      "To the fullest extent permitted by law, Havlo is not liable for any indirect, incidental, special, or consequential loss, or for any loss of savings, profits, data, or opportunity, arising from your use of the site, your reliance on any price or availability, or your dealings with any third-party retailer.",
      "Where we are found liable despite the above, our total liability to you for all claims relating to Havlo is limited to the greater of the commission we actually earned from your transactions in the twelve months before the claim, or USD 100.",
      "Nothing in these terms limits or excludes liability that cannot be limited or excluded by law, including liability for death or personal injury caused by our negligence, for fraud, or under your non-waivable consumer rights.",
    ],
  },
  {
    title: "Your consumer rights",
    paragraphs: [
      "If you use Havlo as a consumer, you keep the benefit of any mandatory consumer-protection rights under the law of the country where you live, for example the Consumer Rights Act in the UK, EU consumer law, or the Federal Competition and Consumer Protection Act in Nigeria. Nothing in these terms reduces those rights, and where a term conflicts with a right you cannot waive, that right prevails.",
    ],
  },
  {
    title: "Privacy",
    paragraphs: [
      "Our Privacy Policy explains what personal data we collect, why, and how we use it, and our Privacy Choices page lets you manage marketing and similar preferences. By using Havlo you also agree to those, which form part of your relationship with us.",
    ],
  },
  {
    title: "Accessibility",
    paragraphs: [
      "Havlo is committed to making price comparison usable by everyone, including people with disabilities, across all our markets and devices. We design the site to work with screen readers, keyboard-only navigation, voice control, and high-contrast or zoomed settings.",
      "We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA, the standard referenced by the European Accessibility Act, the UK Public Sector Bodies Accessibility Regulations, and the US Section 508 update. This is a self-assessment, not yet a third-party audit. We run internal accessibility reviews on every meaningful interface change and automated checks (axe-core) before each release. We review each release across the following:",
    ],
    bullets: [
      "Keyboard-only navigation: every interactive element is reachable with Tab and operable with Enter or Space.",
      "Screen readers: primary flows are tested with VoiceOver (macOS, iOS) and NVDA (Windows), and product cards, filters, and the compare grid carry proper ARIA labels.",
      "Colour contrast: body text meets a 4.5:1 minimum and large text 3:1, the WCAG AA thresholds.",
      "Zoom and layout: content stays usable up to 200% browser zoom on a 320px-wide viewport.",
      "Form labels and errors: every input has an associated label, and validation errors are announced to assistive technology.",
      "Motion: animations respect the prefers-reduced-motion setting, and nothing auto-plays with sound.",
    ],
  },
  {
    title: "Accessibility: known limitations",
    paragraphs: [
      "We are aware of the following gaps and are working on them:",
    ],
    bullets: [
      "Some retailer product images fall back to the product title rather than bespoke alt text. That is meaningful, but not always ideal.",
      "The homepage Trending grid uses CSS columns, which some assistive tech announces as one long list rather than a grid. The /deals page uses a row-by-row grid, which is the recommended path.",
      "Form and validation messaging is in English across all markets for now; translated forms are on the roadmap.",
    ],
  },
  {
    title: "Reporting an accessibility barrier",
    paragraphs: [
      "If you hit an accessibility barrier, or need something in an alternative format such as large print, plain text, or structured data, email hello@havlo.io with the page URL, your browser and assistive-technology setup, and a description of the problem. We aim to acknowledge within 5 working days and to resolve confirmed issues within 30 days, and where a fix takes longer we will provide the content in an alternative format in the meantime.",
      "Consumers in the European Union may also contact their national accessibility-monitoring authority, UK users may escalate to the Equality and Human Rights Commission, and South African users may contact the Information Regulator.",
    ],
  },
  {
    title: "Changes to Havlo and to these terms",
    paragraphs: [
      "We may improve, update, pause, or remove parts of Havlo over time. We may also revise these terms when the product, the law, or our practices change. The current version is always the one shown on this page, with the date it last changed at the top. If a change is significant we will make reasonable efforts to flag it. Continuing to use Havlo after a change means you accept the updated terms.",
    ],
  },
  {
    title: "Governing law and disputes",
    paragraphs: [
      "These terms, and any dispute arising from them, are governed by the laws of the Federal Republic of Nigeria, where Havlo is operated. If you are a consumer, this does not deprive you of the protection of mandatory laws in the country where you live.",
      "If something goes wrong, please contact us first at hello@havlo.io so we can try to resolve it informally. Most issues can be settled that way.",
    ],
  },
  {
    title: "General",
    paragraphs: [
      "These terms, together with our Privacy Policy and any feature-specific terms, are the entire agreement between you and Havlo about your use of the site. If any part is found unenforceable, the rest still applies. Our not enforcing a term is not a waiver of it. You may not transfer your rights under these terms; we may transfer ours as part of a reorganisation or sale of the business. Questions can go to hello@havlo.io.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Terms of Use | Havlo",
  description:
    "The terms that apply when you use Havlo to compare prices, browse deals, and visit third-party retailers, including our accessibility statement.",
  alternates: { canonical: "/terms-of-use" },
  openGraph: {
    title: "Terms of Use · Havlo",
    description:
      "Terms that apply when you use Havlo to compare prices and visit third-party retailers, including our accessibility statement.",
    url: "/terms-of-use",
    type: "website",
  },
};

export default function TermsOfUsePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      description="These terms explain how you may use Havlo, what to expect when you click through to third-party retailers, and how we approach accessibility."
      lastUpdated="21 June 2026"
      sections={sections}
    />
  );
}
