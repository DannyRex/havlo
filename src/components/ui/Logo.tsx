/* ──────────────────────────────────────────────────────────────────
   Havlo brand mark.

   Wordmark in Slackey + a "polished silver" gradient that adapts per
   theme:
     - Light mode: gunmetal silver (dark, with a sheen toward middle)
     - Dark mode:  chrome silver (bright, with a sheen toward middle)
   Vertical 3-stop sheen mimics polished metal — premium feel without
   the AI-cliche purple gradient.

   The gradient lives in globals.css (.logo-metal) driven by a CSS
   variable that flips with the theme so theme switching is reactive
   without needing JS in this component.

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
        className={`inline-flex items-center justify-center leading-none logo-metal ${className}`}
        style={{ ...fontStyle(fontPx), width: size, height: size }}
      >
        h
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-baseline select-none leading-none logo-metal ${className}`}
      aria-label="Havlo"
      style={fontStyle(fontPx)}
    >
      havlo
    </span>
  );
}
