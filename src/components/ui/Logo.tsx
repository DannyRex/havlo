/* ──────────────────────────────────────────────────────────────────
   Single source of truth for the Havlo brand mark in-app.
   Replaces the inline wordmark previously hardcoded in Navbar, Footer,
   and CTA components.

   Variants:
     • <Logo />              — mark + wordmark (default)
     • <Logo variant="mark" /> — square brand mark only (for favicons,
                                  tight UI corners, mobile chip)
   ────────────────────────────────────────────────────────────────── */

interface LogoProps {
  variant?: "full" | "mark";
  /** Height of the mark in px. Wordmark scales proportionally. Default 28. */
  size?: number;
  className?: string;
}

export default function Logo({
  variant = "full",
  size = 28,
  className = "",
}: LogoProps) {
  if (variant === "mark") {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-lg ${className}`}
        style={{
          width: size,
          height: size,
          background: "#0057FF",
        }}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          width={size * 0.62}
          height={size * 0.62}
        >
          <g fill="#FFFFFF">
            <rect x="18" y="15" width="7" height="34" rx="1.5" />
            <rect x="18" y="26" width="27" height="7" rx="1.5" />
            <rect x="38" y="26" width="7" height="23" rx="1.5" />
          </g>
        </svg>
      </span>
    );
  }

  // Full logo: mark + wordmark
  const wordSize = Math.round(size * 0.64); // wordmark font size relative to mark
  return (
    <span
      className={`inline-flex items-center gap-2 select-none ${className}`}
      aria-label="Havlo"
    >
      <Logo variant="mark" size={size} />
      <span
        className="font-bold tracking-[-0.03em] text-ink leading-none"
        style={{ fontSize: wordSize, letterSpacing: "-0.04em" }}
      >
        havlo
      </span>
    </span>
  );
}
