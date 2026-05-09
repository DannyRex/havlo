/* /how-we-make-money OG card. Affiliate-relationships transparency
   page. Renamed from the old /disclaimer route — see redirects in
   next.config.mjs for the legacy URL. The card stays editorial in
   tone (eyebrow "Transparency" instead of "Disclaimer") to match
   the page's Wirecutter-style framing. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "How Havlo makes money — affiliate transparency";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function HowWeMakeMoneyOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Transparency"
        headline="How Havlo"
        subline="makes money."
        subhead="Affiliate links, no inflated prices, no bias on results — the cheapest store still ranks first."
      />
    ),
    size,
  );
}
