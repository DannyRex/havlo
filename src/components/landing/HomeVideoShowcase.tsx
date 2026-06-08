/* Homepage "see how it works" block — two alternating video feature
   sections (spoken.io pattern) using Havlo's own CursorFlow + price-drop
   demo clips. Server component: it just resolves the right file paths for
   the visitor's country and hands them to the client VideoFeatureSection
   (which does the lazy-load + theme-swap).

   Video coverage: the full search->compare CursorFlow render exists for
   uk / us / ng. The other live markets (in / za / ae) fall back to the
   country-neutral explainer clip so we never show, say, a UK £ demo to a
   shopper in India. The price-drop clip is country-agnostic already. */

import VideoFeatureSection from "./VideoFeatureSection";

const CURSORFLOW_COUNTRIES = new Set(["uk", "us", "ng"]);

function flowClip(countryCode: string): { light: string; dark: string } {
  const c = countryCode.toLowerCase();
  if (CURSORFLOW_COUNTRIES.has(c)) {
    return {
      light: `/videos/cursorflow-${c}-desktop-light.mp4`,
      dark:  `/videos/cursorflow-${c}-desktop-dark.mp4`,
    };
  }
  return {
    light: "/videos/explainer-agnostic-light.mp4",
    dark:  "/videos/explainer-agnostic-dark.mp4",
  };
}

export default function HomeVideoShowcase({ countryCode }: { countryCode: string }) {
  const flow = flowClip(countryCode);

  return (
    <>
      <VideoFeatureSection
        eyebrow="Compare in real time"
        title="See what you"
        titleAccent="should actually pay."
        body="Search any product or paste a link, and Havlo lines the price up across local and cross-border stores as you watch. The cheapest option finds you, no tab-hopping."
        srcLight={flow.light}
        srcDark={flow.dark}
        cta={{ label: "Find it cheaper", href: `/${countryCode}/compare` }}
        surface
      />
      <VideoFeatureSection
        eyebrow="Price alerts"
        title="Get told the moment it"
        titleAccent="drops."
        body="Track anything that matters and we'll email you the second its price falls. No refreshing, no watching the tab, no missing the dip."
        srcLight="/videos/pricedrop-light.mp4"
        srcDark="/videos/pricedrop-dark.mp4"
        cta={{ label: "Browse live deals", href: `/${countryCode}/deals` }}
        reverse
      />
    </>
  );
}
