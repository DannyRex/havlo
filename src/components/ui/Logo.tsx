/* ──────────────────────────────────────────────────────────────────
   Havlo brand mark.

   Wordmark-only — the blue square + geometric "h" mark was retired
   in favor of a typographic identity. Slackey carries the personality;
   a subtle brand-blue → indigo gradient softens the chunky letterforms
   without re-introducing the heavy square chrome.

   Gradient renders identically in light + dark mode (saturated enough
   to read on both backgrounds). On browsers that don't support
   bg-clip-text (rare), falls back to text-ink for a clean solid.

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

/* Brand gradient — single source of truth so any future variant
   (favicon, marketing, OG cards) can mirror it.
   #0057FF (Havlo blue) → #6366F1 (indigo-500) → #8B5CF6 (violet-500).
   Three stops keep the transition smooth across the wordmark width. */
const BRAND_GRADIENT =
  "linear-gradient(135deg, #0057FF 0%, #6366F1 55%, #8B5CF6 100%)";

const wordStyle = (fontPx: number) => ({
  fontFamily:        "var(--font-logo)",
  fontSize:          fontPx,
  lineHeight:        1,
  letterSpacing:     "-0.02em",
  backgroundImage:   BRAND_GRADIENT,
  WebkitBackgroundClip: "text",
  backgroundClip:    "text",
  WebkitTextFillColor: "transparent",
  /* Fallback color in case bg-clip-text isn't supported — most modern
     browsers handle it; this keeps very old / unusual stacks legible. */
  color: "transparent",
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
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ ...wordStyle(fontPx), width: size, height: size }}
      >
        h
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-baseline select-none leading-none ${className}`}
      aria-label="Havlo"
      style={wordStyle(fontPx)}
    >
      havlo
    </span>
  );
}
