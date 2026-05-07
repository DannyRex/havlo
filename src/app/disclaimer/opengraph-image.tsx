/* /disclaimer OG card. Affiliate-relationships transparency page. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Havlo disclaimer — how we make money";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function DisclaimerOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Disclaimer"
        headline="How Havlo"
        subline="makes money."
        subhead="Affiliate links, no inflated prices, no bias on results — the cheapest store still ranks first."
      />
    ),
    size,
  );
}
