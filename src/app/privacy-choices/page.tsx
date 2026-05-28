/* /privacy-choices — California-style "Your Privacy Choices" landing.

   Why this page exists:
     - California's CCPA + CPRA require a clear "Do Not Sell or Share
       My Personal Information" link in the footer of any site that
       does business with California residents. Even if (like Havlo)
       we don't "sell" or "share" personal information in CCPA's
       defined sense, the link must lead to a page that says so
       explicitly and offers a way to confirm the user's choice.
     - Several US state laws (VA / CT / CO / UT) have similar opt-
       out requirements that the same page satisfies.
     - Linking it as "Your Privacy Choices" (vs the literal "Do Not
       Sell My Info") matches Global Privacy Control conventions and
       reads less alarming to non-CA users.

   Pairs with: the existing CookieConsent banner (also user-
   controllable) and the privacy policy at /privacy-policy. */

import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

const sections = [
  {
    title: "Short version",
    paragraphs: [
      "Havlo does not sell or share your personal information in the sense California's CCPA, Virginia's VCDPA, Colorado's CPA, Connecticut's CTDPA, or Utah's UCPA define those terms. We do not auction your browsing data to advertisers or to data brokers.",
      "We do use a small number of third-party tools (Google Analytics, Skimlinks affiliate tracking) that you control via the cookie banner. You can change that choice below.",
    ],
  },
  {
    title: "Your specific choices",
    paragraphs: [
      "All of the following are free, take effect immediately, and don't require an account:",
    ],
    bullets: [
      "Reject analytics + affiliate cookies - use the cookie banner. If it isn't visible, clear your browser's localStorage for havlo.io and refresh; the banner will reappear so you can change your selection.",
      "Opt out of marketing emails - every Havlo email has an unsubscribe link in the footer. You can also reply 'remove' to any of our emails.",
      "Request data deletion - email hello@havlo.io from the address you signed up with, and we'll delete your data within 14 days.",
      "Request a copy of your data - email hello@havlo.io. We send a machine-readable JSON of every field associated with you, including newsletter signups, click-through history (truncated /24 IPs), and search-log entries.",
      "Honor Global Privacy Control (GPC) signal - your browser sends a GPC signal automatically if you've enabled it; we treat that as a request to disable analytics + affiliate cookies regardless of any banner state.",
    ],
  },
  {
    title: "What we collect and why",
    paragraphs: [
      "See the full Privacy Policy for the comprehensive list. The categories most relevant to your privacy choices are:",
    ],
    bullets: [
      "Identifiers: IP address (truncated to /24 in our logs), browser type, OS - used for security, debugging, and country-detection so we can show local retailers.",
      "Internet activity: pages viewed, searches submitted, deals clicked - used to rank results + measure feature performance.",
      "Commercial information: only what you explicitly submit (newsletter signups, contact-form messages, notify-me requests).",
    ],
  },
  {
    title: "Sale or share - formal disclosure",
    paragraphs: [
      "For the avoidance of doubt under CCPA/CPRA: in the past 12 months Havlo has not sold or shared personal information. We do not engage in 'targeted advertising' as defined by VCDPA/CTDPA. We do not profile users for automated decisions producing legal or similarly significant effects.",
    ],
  },
  {
    title: "Authorized agents",
    paragraphs: [
      "If you have an authorized agent acting on your behalf, they can submit a privacy request to hello@havlo.io. We will verify the agency relationship before acting on the request (usually a signed letter from you authorizing the agent).",
    ],
  },
  {
    title: "Non-discrimination",
    paragraphs: [
      "Havlo will not deny you service, charge you a different price, or provide a different quality of service if you exercise any of the choices on this page.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "For any privacy choice not listed above, email hello@havlo.io with the request. We respond within 14 days. California residents who are unsatisfied with our response can contact the California Privacy Protection Agency (CPPA).",
    ],
  },
];

export const metadata: Metadata = {
  title:       "Your Privacy Choices · Havlo",
  description: "How to opt out of analytics, marketing, or data processing on Havlo - under CCPA, CPRA, VCDPA, CTDPA, CPA, UCPA, and equivalent laws.",
};

export default function PrivacyChoicesPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Your privacy choices"
      description="What you can opt out of, how to do it, and how Havlo responds to formal privacy requests under US state laws."
      lastUpdated="28 May 2026"
      sections={sections}
    />
  );
}
