/* ──────────────────────────────────────────────────────────────────
   Brand fallback for product cards with no image.

   When a product has image_url=null OR the image fails to load
   (CDN block, 404, network), we replace the broken image with the
   Havlo "h" logo mark on a neutral surface instead of the previous
   emoji-on-gradient pattern.

   Uses a plain <img> (not next/image) deliberately. The fallback
   renders on EVERY image-less card surface — masonry grid, list
   view, compare cards, PDP. With next/image, each render hit
   Vercel's image optimizer and counted against the 5,000/mo free-
   tier transformation budget. Going through next/image to serve a
   static 512×512 PNG saved nothing (PNG was already optimized at
   build time) and burnt transformations needlessly. Plain <img>
   skips the optimizer, gets served from Vercel's CDN edge cache,
   and never charges a transformation.
   ────────────────────────────────────────────────────────────────── */

interface Props {
  /** Inner mark size in pixels. `sm` for list thumbs, `md` for grid
      cards, `lg` for hero / detail-page renders. */
  size?: "sm" | "md" | "lg";
  /** Append to wrapper className for sizing / positioning overrides. */
  className?: string;
}

const SIZE_PX: Record<NonNullable<Props["size"]>, number> = {
  sm: 40,
  md: 72,
  lg: 120,
};

export default function HavloLogoFallback({ size = "md", className = "" }: Props) {
  const px = SIZE_PX[size];
  return (
    <div
      /* bg-surface-2 matches the elevated card surface so the fallback
         blends with the surrounding card chrome. The brand mark is
         dark with a chrome "h" — sits cleanly on either light or
         dark surface tokens. */
      className={`absolute inset-0 flex items-center justify-center bg-surface-2 ${className}`}
      aria-hidden="true"
    >
      {/* Plain <img> — skips next/image optimizer to preserve free-tier
          transformation budget. /icon.png is a static 512×512 brand
          mark served from Vercel's CDN; no need to re-transform per
          device size. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.png"
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        className="rounded-lg opacity-95"
      />
    </div>
  );
}
