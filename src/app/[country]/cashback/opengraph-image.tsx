/* /[country]/cashback OG card. Pre-launch waitlist surface — the
   eyebrow stays "Coming soon" everywhere until Phase 2 ships. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Cashback on Havlo — coming soon";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function CashbackOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Cashback · Coming soon"
        headline="Earn cashback"
        subline="when you shop through Havlo."
        subhead="Up to 5% back at the stores you already use. Join the waitlist for launch in a few weeks."
        statusDot={{ color: "#22C55E", text: "Phase 2 in build" }}
      />
    ),
    size,
  );
}
