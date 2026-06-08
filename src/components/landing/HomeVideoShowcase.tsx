/* Homepage "see how it works" block — two alternating video feature
   sections using Havlo's own CursorFlow + price-drop demo clips. Server
   component: it resolves the right clip URLs for the visitor's country
   and hands them to the client VideoFeatureSection (lazy-load + theme
   swap).

   Clips are served from the public Supabase Storage bucket (site-media)
   so they ride its CDN and don't add weight to the repo / Vercel build.
   Coverage: the full search->compare CursorFlow render exists for
   uk / us / ng; the other live markets (in / za / ae) fall back to the
   country-neutral explainer so we never show a wrong-currency demo. */

import VideoFeatureSection from "./VideoFeatureSection";

/* Public bucket base. The project ref is already public (every product
   image URL on the site uses it), so it's safe to inline. */
const VIDEO_BASE =
  "https://fmjqzoplzyjduxqxlfqg.supabase.co/storage/v1/object/public/site-media/videos";

const CURSORFLOW_COUNTRIES = new Set(["uk", "us", "ng"]);

function flowClip(countryCode: string): { light: string; dark: string } {
  const c = countryCode.toLowerCase();
  const name = CURSORFLOW_COUNTRIES.has(c) ? `cursorflow-${c}-desktop` : "explainer-agnostic";
  return { light: `${VIDEO_BASE}/${name}-light.mp4`, dark: `${VIDEO_BASE}/${name}-dark.mp4` };
}

export default function HomeVideoShowcase({ countryCode }: { countryCode: string }) {
  const flow = flowClip(countryCode);

  return (
    <>
      <VideoFeatureSection
        eyebrow="Compare prices"
        title="See what you"
        titleAccent="should actually pay."
        body="Search a product or paste a link from any store. We check the price across local and overseas shops, so you can see who's cheapest before you buy."
        srcLight={flow.light}
        srcDark={flow.dark}
        cta={{ label: "Find it cheaper", href: `/${countryCode}/compare` }}
        surface
      />
      <VideoFeatureSection
        eyebrow="Price alerts"
        title="Get told the moment it"
        titleAccent="drops."
        body="Add anything to your watchlist and we'll email you when the price falls. Set it once, then leave the checking to us."
        srcLight={`${VIDEO_BASE}/pricedrop-light.mp4`}
        srcDark={`${VIDEO_BASE}/pricedrop-dark.mp4`}
        cta={{ label: "Browse live deals", href: `/${countryCode}/deals` }}
        reverse
      />
    </>
  );
}
