/* ──────────────────────────────────────────────────────────────────
   Brand fallback for product cards with no image.

   When a product has image_url=null OR the image fails to load
   (CDN block, 404, network), we replace the broken image with the
   Havlo "h" logo mark on a neutral surface instead of the previous
   emoji-on-gradient pattern.

   Why: the emoji-on-gradient looked decorative but inconsistent
   across cards (each Deal got a different gradient + emoji at
   ingest, so a row of fallbacks looked like 5 unrelated coloured
   tiles). The logo mark keeps the surface feeling like Havlo —
   reinforces brand recognition on the small fraction of products
   without imagery, and reads as intentional rather than
   "missing image."

   Drop-in replacement: render inside an absolute-positioned parent
   (cards) or a relatively-sized parent — the wrapper takes the
   parent's full width/height.
   ────────────────────────────────────────────────────────────────── */
import Image from "next/image";

interface Props {
  /** Inner mark size. `sm` for list thumbs, `md` for grid cards,
      `lg` for hero / detail-page renders. */
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
      <Image
        src="/logo-mark.svg"
        alt=""
        width={px}
        height={px}
        priority={false}
        className="opacity-90"
      />
    </div>
  );
}
