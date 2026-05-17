/* Homepage OG card — 1200×630 PNG generated at the edge.
   Renders the Havlo wordmark on the dark zinc-950 panel that the rest
   of the site uses for its CTA + accent surfaces. Editorial type pairing
   matches the site (Inter / Bricolage in the live UI; ImageResponse runs
   without web fonts so we use the system stack here for crisp render). */

import { ImageResponse } from "next/og";

export const runtime    = "edge";
export const alt        = "Havlo · Find similar products for less";
export const size       = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function HomeOG() {
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
        {/* Top row — wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://havlo.io/icon.png"
              alt="Havlo"
              width={44}
              height={44}
              style={{ width: 44, height: 44, objectFit: "cover" }}
            />
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
            Havlo
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Headline */}
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
            Paste a link or search anything. Havlo finds cheaper alternatives
            across the stores you already know.
          </div>
        </div>

        {/* Bottom accent — live pill */}
        <div style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#22C55E",
            }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Live · 12+ stores worldwide
          </span>
        </div>
      </div>
    ),
    size,
  );
}
