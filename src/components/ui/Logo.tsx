/* ──────────────────────────────────────────────────────────────────
   Havlo brand mark.

   Wordmark-only — the blue square + geometric "h" mark was retired
   in favor of a typographic identity. Slackey carries the personality;
   the wordmark stays in `text-ink` so it adapts to both themes
   without needing two SVG variants.

   Variants:
     • <Logo />              — full wordmark (default)
     • <Logo variant="mark" /> — single "h" for tight spaces (mobile
                                 nav corners, app icon stand-ins).
                                 Same Slackey letterform, no chrome.
   ────────────────────────────────────────────────────────────────── */

interface LogoProps {
  variant?: "full" | "mark";
  /** Visual height in px. Wordmark scales font-size from this. Default 28. */
  size?: number;
  className?: string;
}

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
        className={`inline-flex items-center justify-center text-ink leading-none ${className}`}
        style={{
          fontFamily: "var(--font-logo)",
          fontSize: fontPx,
          lineHeight: 1,
          width: size,
          height: size,
        }}
      >
        h
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-baseline select-none text-ink leading-none ${className}`}
      aria-label="Havlo"
      style={{
        fontFamily: "var(--font-logo)",
        fontSize: fontPx,
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      havlo
    </span>
  );
}
