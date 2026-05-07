/**
 * Fire-and-forget click telemetry. Never throws — must not affect UX.
 *
 * Mirrors to BOTH:
 *   1. Internal /api/click DB log (drives popularity ranking + the
 *      `popular` sort option on /deals)
 *   2. GA4 `click_out_merchant` event so the Acquisition / Conversion
 *      reports in GA see what shoppers click vs. just what they view.
 *
 * @param dealId   group.key or dupe.key — stable identifier for this product group
 * @param query    the search query that surfaced this result
 * @param position 0-indexed rank (0 = best/first result)
 * @param mode     "single" | "list" | "similar"
 * @param storeId  optional — used by the GA4 mirror for store segmentation
 */
import { track } from "@/lib/analytics";

export function trackClick(
  dealId: string,
  query: string,
  position: number,
  mode: string,
  storeId?: string,
): void {
  /* DB log — primary signal for the in-app `popular` sort. */
  fetch("/api/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, query, position, mode }),
  }).catch(() => {});

  /* GA4 mirror — only fires when consent + GA env are both ready
     (the analytics wrapper handles both gates internally). */
  track({
    name: "click_out_merchant",
    props: {
      store_id: storeId ?? "unknown",
      position,
      mode,
      query,
    },
  });
}
