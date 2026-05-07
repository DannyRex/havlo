/* /terms-of-use OG card. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Havlo terms of use";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function TermsOfUseOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Terms of use"
        headline="The ground rules,"
        subline="kept short."
        subhead="What you can do, what we can do, and the bits we have to spell out for the lawyers."
      />
    ),
    size,
  );
}
