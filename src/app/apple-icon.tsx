/* Next.js 14 Apple touch icon — served at /apple-icon.
   180x180 PNG used when users add Havlo to iOS home screen.
   Mirrors /icon — chunky white "h" on dark gradient. */

import { ImageResponse } from "next/og";

export const size        = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime     = "edge";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundImage:
            "linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 60%, #0E0E0E 100%)",
          /* iOS auto-rounds the corners but a hint helps the splash. */
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <g fill="#FFFFFF">
            <rect x="14" y="10" width="9"  height="44" rx="2.5" />
            <rect x="14" y="26" width="36" height="9"  rx="2.5" />
            <rect x="41" y="26" width="9"  height="28" rx="2.5" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
