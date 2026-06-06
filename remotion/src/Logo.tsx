import React from "react";
import { LOGO_FONT } from "./fonts";
import { MARK_BG, type Theme } from "./brand";

/* The real Havlo logo: silver-metal "havlo" wordmark in Slackey, with a
   per-theme polished-metal gradient (chrome on dark, gunmetal on light)
   clipped to the text. Mirrors .logo-metal in the app. No blue. */

const metalText = (theme: Theme): React.CSSProperties => ({
  fontFamily: LOGO_FONT,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  backgroundImage: theme.logoGrad,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
});

export const HavloWordmark: React.FC<{ theme: Theme; size?: number }> = ({ theme, size = 84 }) => (
  <span
    aria-label="havlo"
    style={{
      ...metalText(theme),
      fontSize: size,
      /* Drop-shadow only on dark (helps the chrome pop). Flat on light
         per founder direction — no shadows on the light logo. */
      filter: theme.name === "dark" ? "drop-shadow(0 2px 5px rgba(0,0,0,0.22))" : "none",
    }}
  >
    havlo
  </span>
);

/* "h" mark on a rounded tile. Theme-adaptive so it never reads as a
   black square on white: dark tile (favicon look) on dark, clean white
   tile with a soft border + shadow on light. The "h" keeps the metal
   gradient in both. */
export const HavloMark: React.FC<{ theme: Theme; size?: number }> = ({ theme, size = 64 }) => {
  const isDark = theme.name === "dark";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: isDark ? MARK_BG : "#FFFFFF",
        border: `1px solid ${theme.border}`,
        /* No shadow on the light mark (founder direction). Dark keeps a
           soft lift so the tile separates from the near-black bg. */
        boxShadow: isDark ? "0 8px 26px rgba(0,0,0,0.35)" : "none",
      }}
    >
      <span style={{ ...metalText(theme), fontSize: size * 0.6, paddingBottom: size * 0.04 }}>h</span>
    </span>
  );
};

/* Lockup: mark + wordmark, used on the CTA / end card. */
export const HavloLockup: React.FC<{ theme: Theme; size?: number }> = ({ theme, size = 64 }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}>
    <HavloMark theme={theme} size={size} />
    <HavloWordmark theme={theme} size={size * 1.28} />
  </div>
);
