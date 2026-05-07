/* /privacy-policy OG card. Surfaces during compliance-team shares
   and trust-page audits. Plain, unflashy framing. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Havlo privacy policy — what we collect and why";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function PrivacyPolicyOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Privacy"
        headline="Plain English."
        subline="No surprises."
        subhead="Named processors, retention windows, and your rights — written so you can actually read it."
      />
    ),
    size,
  );
}
