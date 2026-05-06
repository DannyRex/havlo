/* /compare OG card — leans on the "Find for less" CTA wording. */

import { ImageResponse } from "next/og";

export const runtime    = "edge";
export const alt        = "Find for less · Havlo";
export const size       = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function CompareOG() {
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

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -3,
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Before you buy it,</span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>find it for less.</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 820,
              lineHeight: 1.4,
            }}
          >
            Paste a link or search anything. Cheaper alternatives across
            the stores you already know.
          </div>
        </div>

        <div style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 18 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              padding: "12px 22px",
              borderRadius: 999,
              background: "#FFFFFF",
              color: "#09090B",
            }}
          >
            Find for less →
          </span>
          <span style={{ fontSize: 18, color: "rgba(255,255,255,0.55)" }}>
            havlo.io/compare
          </span>
        </div>
      </div>
    ),
    size,
  );
}
