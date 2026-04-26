/* Next.js 14 generated favicon — served at /icon.
   Brand-blue rounded square + white "h" geometry.
   Returns a 32×32 PNG at request time, cached by Vercel's edge. */

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime = "edge";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0057FF",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 64 64">
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
