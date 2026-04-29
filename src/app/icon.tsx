/* Next.js 14 generated favicon — served at /icon.
   Geometric chunky "h" on a dark gradient backdrop. Matches the
   refreshed brand mark (dark slate body + white letterform).

   Returns a 32x32 PNG at request time, cached at the edge. */

import { ImageResponse } from "next/og";

export const size        = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime     = "edge";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          /* Dark backdrop with a subtle diagonal sheen (lighter top-
             right → darker bottom-left). Same character as the
             user-provided reference. */
          backgroundImage:
            "linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 60%, #0E0E0E 100%)",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Geometric "h" — two vertical strokes + horizontal connector.
            Rounded corners (rx=2.5) match the chunky-but-soft look. */}
        <svg width="22" height="22" viewBox="0 0 64 64">
          <g fill="#FFFFFF">
            {/* Left stroke — full height */}
            <rect x="14" y="10" width="9"  height="44" rx="2.5" />
            {/* Crossbar */}
            <rect x="14" y="26" width="36" height="9"  rx="2.5" />
            {/* Right stroke — half height */}
            <rect x="41" y="26" width="9"  height="28" rx="2.5" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
