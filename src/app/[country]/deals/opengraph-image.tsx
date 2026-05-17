/* /deals OG card — branded for the browse feed.
   Refactored May 2026 v3 to use the shared OgShell component. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Deals worth checking today · Havlo";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function DealsOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Today's deals"
        headline="Real price drops,"
        subline="updated daily."
        pills={["Phones", "Audio", "Computing", "Beauty", "Sports"]}
      />
    ),
    size,
  );
}
