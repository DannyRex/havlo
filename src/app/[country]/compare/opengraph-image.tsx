/* /compare OG card — leans on the "Find for less" CTA wording.
   Refactored May 2026 v3 to use the shared OgShell component. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Find for less · Havlo";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function CompareOG() {
  return new ImageResponse(
    (
      <OgShell
        headline="Before you buy it,"
        subline="find it for less."
        subhead="Paste a link or search anything. Cheaper alternatives across the stores you already know."
        pills={["havlo.io/compare"]}
      />
    ),
    size,
  );
}
