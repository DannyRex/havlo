/* Next.js 14 Apple touch icon — served at /apple-icon.
   180×180 PNG, used when users add Havlo to their iOS home screen. */

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0057FF",
          /* iOS auto-rounds the corners, but a hint helps the splash. */
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <g fill="#FFFFFF">
            <rect x="18" y="15" width="7" height="34" rx="1.5" />
            <rect x="18" y="26" width="27" height="7" rx="1.5" />
            <rect x="38" y="26" width="7" height="23" rx="1.5" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
