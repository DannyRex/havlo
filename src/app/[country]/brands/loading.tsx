import HubSkeleton from "@/components/hub/HubSkeleton";

/* Brand index loading state. Without this file the segment inherited the
   HOMEPAGE shell, which bears no resemblance to the index. The "chip"
   variant paints short brand-link tiles (cols 2/3/4) instead of product
   cards, mirroring brands/page.tsx. */
export default function Loading() {
  return <HubSkeleton variant="chip" />;
}
