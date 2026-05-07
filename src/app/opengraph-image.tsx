/* Root-level default OG card. Auto-inherits to every route that
   doesn't have its own opengraph-image.tsx (legal pages, /contact,
   /[country]/cashback, /[country]/blog/[slug], etc.).

   Mirrors /[country]/opengraph-image.tsx visually but without the
   per-country accent line so it's safe as a generic fallback.

   1200×630 PNG generated at the edge. */

import { ImageResponse } from "next/og";

export const runtime    = "edge";
export const alt        = "Havlo · Find similar products for less";
export const size       = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function DefaultOG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#09090B",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          color: "#FFFFFF",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#0057FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 64 64">
              <g fill="#FFFFFF">
                <rect x="18" y="15" width="7" height="34" rx="1.5" />
                <rect x="18" y="26" width="27" height="7" rx="1.5" />
                <rect x="38" y="26" width="7" height="23" rx="1.5" />
              </g>
            </svg>
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
            havlo
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -3,
              maxWidth: 980,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Find similar products</span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>for less.</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 780,
              lineHeight: 1.4,
            }}
          >
            Paste a link or search anything. Cheaper alternatives across the
            stores you already know.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
