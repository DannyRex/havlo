import HubSkeleton from "@/components/hub/HubSkeleton";

/* Category hub loading state. Without this file the segment inherited
   deals/loading.tsx — the deals-feed shell (search bar + sticky filter
   toolbar with tier pills + stores button) — chrome the category hub
   doesn't have, so the swap painted a layout that vanished on load.
   HubSkeleton mirrors deals/[category]/page.tsx exactly. */
export default function Loading() {
  return <HubSkeleton variant="product" />;
}
