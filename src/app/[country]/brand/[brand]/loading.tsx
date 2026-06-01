import HubSkeleton from "@/components/hub/HubSkeleton";

/* Brand hub loading state. Without this file the segment inherited the
   nearest ancestor — the HOMEPAGE shell (hero + trending rail + category
   grid + store-logo marquee) — which looks nothing like a brand hub, so
   the content swap hard-jumped. HubSkeleton mirrors brand/[brand]/page.tsx
   (breadcrumb + hero + product grid + category chips + newsletter). */
export default function Loading() {
  return <HubSkeleton variant="product" />;
}
