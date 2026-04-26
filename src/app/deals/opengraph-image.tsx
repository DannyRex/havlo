/* /deals OG card — branded for the browse feed.
   Same panel + wordmark system as the homepage card so previews on
   Twitter / WhatsApp / Slack feel like a single product, not three. */

import { ImageResponse } from "next/og";

export const runtime    = "edge";
export const alt        = "Deals worth checking today · Havlo";
export const size       = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function DealsOG() {
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
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#22C55E",
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            Today&apos;s deals
          </span>
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -3,
              maxWidth: 1000,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Real price drops,</span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>updated daily.</span>
          </div>
        </div>

        <div style={{ marginTop: 48, display: "flex", gap: 14 }}>
          {["Phones", "Audio", "Computing", "Beauty", "Sports"].map((cat) => (
            <span
              key={cat}
              style={{
                fontSize: 20,
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {cat}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
