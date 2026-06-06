/* ──────────────────────────────────────────────────────────────────
   Havlo brand kit for video — mirrored 1:1 from the live app
   (globals.css, tailwind.config.ts, StoreLogos.tsx, Hero.tsx).

   Identity rules (founder direction, June 2026):
     • Accent is the DEAL-GREEN, never the old blue. Blue is retired.
     • Logo is the silver-metal "havlo" wordmark (Slackey), "h" mark.
   ────────────────────────────────────────────────────────────────── */

export type ThemeName = "dark" | "light";

export interface Theme {
  name: ThemeName;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  ink: string;
  inkSub: string;
  inkFaint: string;
  green: string;
  greenSoft: string;
  /** Silver-metal gradient for the wordmark (per-theme, from .logo-metal). */
  logoGrad: string;
  glow: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: "dark",
    bg: "#0A0C10",
    surface: "#13161D",
    surface2: "#1C2029",
    border: "rgba(255,255,255,0.09)",
    ink: "#F6F8FB",
    inkSub: "#B2B8C4",
    inkFaint: "#7A8290",
    green: "#4ADE80",        // --success-rgb dark (green-400)
    greenSoft: "rgba(74,222,128,0.14)",
    logoGrad: "linear-gradient(165deg, #F1F5F9 0%, #94A3B8 100%)", // chrome
    glow: "rgba(74,222,128,0.16)",
  },
  light: {
    name: "light",
    bg: "#FFFFFF",
    surface: "#FFFFFF",
    surface2: "#F5F7FA",
    border: "#DEE2EA",
    ink: "#0F172A",
    inkSub: "#3D4B60",
    inkFaint: "#566277",
    green: "#16A34A",        // --success-rgb light (green-600)
    greenSoft: "rgba(22,163,74,0.10)",
    logoGrad: "linear-gradient(165deg, #1E293B 0%, #475569 100%)", // gunmetal
    glow: "rgba(22,163,74,0.10)",
  },
};

/** Dark-mode "h" tile (near-black, matches the favicon). In light mode
    the mark flips to a clean white tile so it doesn't read as a black
    square on the page — see Logo.tsx. */
export const MARK_BG = "#15181F";

/* Real platform reach — matches the live OG image's
   "Live · 1,500+ stores worldwide" (distinct catalog stores, far larger
   than the 87-name curated marquee). Use THIS in the videos. */
export const STORES_LABEL = "1,500+ stores worldwide";
export const MARKET_COUNT = 6; // launched markets (DE deferred)
