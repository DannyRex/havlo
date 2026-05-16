/* ──────────────────────────────────────────────────────────────────
   Brand fallback for product cards with no image.

   When a product has image_url=null OR the image fails to load
   (CDN block, 404, network), we replace the broken image with the
   Havlo "h" logo mark on a neutral surface instead of the previous
   emoji-on-gradient pattern.

   Why inline the SVG rather than <Image src="/logo-mark.svg">:
   next/image rejects SVG sources by default (it's a known security
   posture — SVG can carry scripts). Enabling `dangerouslyAllowSVG`
   in next.config would unlock it but opens the door to user-supplied
   SVGs in product imagery being executed. The brand mark is fixed,
   tiny (~250 bytes), and renders faster as inline JSX than as a
   separate optimizer round-trip — so we inline it.

   Drop-in replacement: render inside an absolute-positioned parent
   (cards) or a relatively-sized parent — the wrapper takes the
   parent's full width/height.
   ────────────────────────────────────────────────────────────────── */

interface Props {
  /** Inner mark size in pixels. `sm` for list thumbs, `md` for grid
      cards, `lg` for hero / detail-page renders. */
  size?: "sm" | "md" | "lg";
  /** Append to wrapper className for sizing / positioning overrides. */
  className?: string;
}

const SIZE_PX: Record<NonNullable<Props["size"]>, number> = {
  sm: 32,
  md: 56,
  lg: 96,
};

export default function HavloLogoFallback({ size = "md", className = "" }: Props) {
  const px = SIZE_PX[size];
  return (
    <div
      /* bg-surface-2 matches the elevated card surface so the fallback
         blends with the surrounding card chrome. The logo mark has its
         own brand-blue ground baked into the SVG, so it stands out
         cleanly on the neutral wrapper. */
      className={`absolute inset-0 flex items-center justify-center bg-surface-2 ${className}`}
      aria-hidden="true"
    >
      {/* Inline Havlo "h" mark — matches /public/logo-mark.svg.
          Brand-blue rounded square + lowercase 'h' construction. */}
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Havlo"
        className="opacity-90"
      >
        <title>Havlo</title>
        <rect width="64" height="64" rx="14" fill="#0057FF" />
        <g fill="#FFFFFF">
          {/* Left vertical stem (full height) */}
          <rect x="18" y="15" width="7" height="34" rx="1.5" />
          {/* Mid horizontal connector */}
          <rect x="18" y="26" width="27" height="7" rx="1.5" />
          {/* Right vertical (from mid to baseline) */}
          <rect x="38" y="26" width="7" height="23" rx="1.5" />
        </g>
      </svg>
    </div>
  );
}
