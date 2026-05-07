/* /[country]/blog index OG card. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Havlo Blog — buying guides + price intel";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function BlogIndexOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Blog"
        headline="Buying guides"
        subline="without the fluff."
        subhead="Hands-on price comparisons, counterfeit warnings, and cross-border cost breakdowns."
        pills={["Phones", "Cross-border", "Beauty", "Counterfeit guide"]}
      />
    ),
    size,
  );
}
