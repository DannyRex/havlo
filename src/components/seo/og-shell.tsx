/* Shared OG card layout for all opengraph-image.tsx files.
   Edge-runtime safe — pure JSX, no React hooks, no DOM APIs.

   Why factored out: we now generate OG cards for ~10 surfaces (home,
   deals, compare, blog index, individual posts, contact, privacy,
   terms, disclaimer, cashback). Without this helper each file
   duplicated 80 lines of identical wordmark + panel chrome. Any
   visual tweak to the OG system would need 10 file edits.

   Use:
     return new ImageResponse(
       <OgShell eyebrow="Cashback" headline="Earn cashback when you shop." subhead="Coming soon." />,
       size,
     );
*/

import type { ReactNode } from "react";

interface OgShellProps {
  /** Small label above the headline. UPPERCASE, accent colour.
      Examples: "Cashback · Coming Soon", "Today's deals", "Blog". */
  eyebrow?: string;
  /** Big headline. Two lines max. Second line gets 60% opacity for
      the "Find similar products / for less." rhythm. */
  headline: string;
  /** Optional softer second line. Rendered at 60% white. */
  subline?: string;
  /** Body subhead under the headline. Plain text, ~2 lines. */
  subhead?: string;
  /** Optional pills / chips at the bottom (categories, tags). */
  pills?: string[];
  /** Optional bottom-left status indicator. Pass null to hide. */
  statusDot?: { color: string; text: string } | null;
  /** Eyebrow accent. Defaults to brand green. */
  eyebrowColor?: string;
}

export function OgShell({
  eyebrow,
  headline,
  subline,
  subhead,
  pills,
  statusDot,
  eyebrowColor = "#22C55E",
}: OgShellProps): ReactNode {
  return (
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
      {/* Wordmark */}
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

      {/* Eyebrow + headline + subhead */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {eyebrow && (
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: eyebrowColor,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            {eyebrow}
          </span>
        )}
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: -3,
            maxWidth: 1000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>{headline}</span>
          {subline && (
            <span style={{ color: "rgba(255,255,255,0.6)" }}>{subline}</span>
          )}
        </div>
        {subhead && (
          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            {subhead}
          </div>
        )}
      </div>

      {/* Optional pills row */}
      {pills && pills.length > 0 && (
        <div style={{ marginTop: 40, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {pills.map((p) => (
            <span
              key={p}
              style={{
                fontSize: 20,
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Bottom status dot */}
      {statusDot && (
        <div
          style={{
            marginTop: pills && pills.length > 0 ? 28 : 56,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: statusDot.color,
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
            {statusDot.text}
          </span>
        </div>
      )}
    </div>
  );
}

export const OG_SIZE = { width: 1200, height: 630 } as const;
