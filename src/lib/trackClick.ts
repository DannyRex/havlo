/**
 * Fire-and-forget click telemetry. Never throws — must not affect UX.
 *
 * @param dealId   group.key or dupe.key — stable identifier for this product group
 * @param query    the search query that surfaced this result
 * @param position 0-indexed rank (0 = best/first result)
 * @param mode     "single" | "list" | "similar"
 */
export function trackClick(
  dealId: string,
  query: string,
  position: number,
  mode: string,
): void {
  fetch("/api/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dealId, query, position, mode }),
  }).catch(() => {});
}
