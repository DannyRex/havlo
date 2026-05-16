/* ──────────────────────────────────────────────────────────────────
   Brand fallback for product cards with no image.

   When a product has image_url=null OR the image fails to load
   (CDN block, 404, network), we replace the broken image with the
   Havlo "h" logo mark on a neutral surface instead of the previous
   emoji-on-gradient pattern.

   Uses /icon.png — the 512×512 brand mark (copy of src/app/icon.png
   placed in public/ so it's reachable from a component via next/image).
   PNG passes next/image's default security policy (no scripts), so
   no dangerouslyAllowSVG flag required.

   Drop-in replacement: render inside an absolute-positioned parent
   (cards) or a relatively-sized parent — the wrapper takes the
   parent's full width/height.
   ────────────────────────────────────────────────────────────────── */
import Image from "next/image";

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
      <Image
        src="/icon.png"
        alt=""
        width={px}
        height={px}
        priority={false}
        className="rounded-lg opacity-95"
      />
    </div>
  );
}
