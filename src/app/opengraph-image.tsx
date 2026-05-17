/* Root-level default OG card. Auto-inherits to every route that
   doesn't have its own opengraph-image.tsx (legal pages, /contact,
   /[country]/cashback, /[country]/blog/[slug], etc.).

   Refactored May 2026 v3 to use the shared OgShell component —
   matches the other ~7 OG surfaces. Future logo / chrome / wordmark
   tweaks are now one-line edits in og-shell.tsx instead of needing
   four parallel file changes.

   1200×630 PNG generated at the edge. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Havlo · Find similar products for less";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function DefaultOG() {
  return new ImageResponse(
    (
      <OgShell
        headline="Find similar products"
        subline="for less."
        subhead="Paste a link or search anything. Cheaper alternatives across the stores you already know."
      />
    ),
    size,
  );
}
