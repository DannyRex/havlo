/* ──────────────────────────────────────────────────────────────────
   Havlo brand mark.

   Wordmark-only — the blue square + geometric "h" mark was retired
   in favor of a typographic identity. Slackey carries the personality;
   a single confident color in the emerald family gives identity
   without an AI-cliche gradient.

   Why emerald:
     - Green = money / savings / value, which IS Havlo's product
     - Distinctive vs blue (corporate cliche) and red (urgency cliche)
     - Mature: real emerald, not bright lime

   Why two shades (light + dark):
     - emerald-700 (#047857) → ~7.5:1 contrast on white ✓
     - emerald-400 (#34D399) → ~7:1 contrast on near-black ✓
     - Same color family, adjusted brightness per surface so the brand
       reads with the same energy in both themes.

   Variants:
     • <Logo />              — full wordmark (default)
     • <Logo variant="mark" /> — single "h" for tight spaces.
   ────────────────────────────────────────────────────────────────── */

interface LogoProps {
  variant?: "full" | "mark";
  /** Visual height in px. Wordmark scales font-size from this. Default 28. */
  size?: number;
  className?: string;
}

/* Brand colors exported as constants so future surfaces (favicon, OG
   cards, marketing) mirror them without drift. */
export const BRAND_COLOR_LIGHT = "#047857"; // emerald-700 — for light mode
export const BRAND_COLOR_DARK  = "#34D399"; // emerald-400 — for dark mode

/* Tailwind classes for theme-adaptive text color. Matches the
   constants above. Inline style + Tailwind dark: variant don't mix
   well; using className keeps theme switching reactive. */
const COLOR_CLASS = "text-[#047857] dark:text-[#34D399]";

const fontStyle = (fontPx: number) => ({
  fontFamily:    "var(--font-logo)",
  fontSize:      fontPx,
  lineHeight:    1,
  letterSpacing: "-0.02em",
} as const);

export default function Logo({
  variant = "full",
  size = 28,
  className = "",
}: LogoProps) {
  /* Slackey ships at a small visual size relative to its em-box, so we
     scale font-size up roughly 1.4× the requested mark height to land
     close to the previous logo's optical weight. */
  const fontPx = Math.round(size * 1.4);

  if (variant === "mark") {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center leading-none ${COLOR_CLASS} ${className}`}
        style={{ ...fontStyle(fontPx), width: size, height: size }}
      >
        h
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-baseline select-none leading-none ${COLOR_CLASS} ${className}`}
      aria-label="Havlo"
      style={fontStyle(fontPx)}
    >
      havlo
    </span>
  );
}
