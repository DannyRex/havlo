/* Homepage OG card — 1200×630 PNG generated at the edge.
   Renders the Havlo wordmark on the dark zinc-950 panel that the rest
   of the site uses for its CTA + accent surfaces.

   Refactored May 2026 v3 to use the shared OgShell component. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Havlo · Find similar products for less";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function HomeOG() {
  return new ImageResponse(
    (
      <OgShell
        headline="Find similar products"
        subline="for less."
        subhead="Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know."
        statusDot={{ color: "#22C55E", text: "Live · 12+ stores worldwide" }}
      />
    ),
    size,
  );
}
