/* /contact OG card. Surfaces the human-contact pitch when the page
   gets shared (rare but happens for support escalations + press). */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";

export const runtime    = "edge";
export const alt        = "Contact Havlo — get in touch with the team";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default function ContactOG() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Contact"
        headline="A real human"
        subline="will reply."
        subhead="Questions, store partnerships, press, or anything else — we read every message."
      />
    ),
    size,
  );
}
