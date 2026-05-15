/* Client-side search-event logger.

   Fire-and-forget. Uses navigator.sendBeacon when available (most
   reliable for pagehide / unload scenarios) and falls back to a
   non-awaited fetch when sendBeacon isn't available (older browsers,
   SSR safety).

   Called from:
     - Hero submit (mode: text or url)
     - /compare on search submit
     - /deals when a search query produces results (or zero)

   The server route (`/api/log-search`) silently no-ops on bad
   input, so callers don't need to validate beyond basic shape.

   Why a thin wrapper instead of inline fetches:
     • Consistent shape across surfaces.
     • Single place to gate (disable logging in dev, throttle if
       traffic spikes, etc.).
     • Lets us swap to sendBeacon for unload-safety without
       touching call sites. */

export interface LogSearchInput {
  query:        string;
  surface:      "hero" | "deals" | "compare";
  mode?:        "text" | "url";
  resultCount?: number;
}

export function logSearchEvent(input: LogSearchInput): void {
  if (typeof window === "undefined") return;
  const q = input.query?.trim();
  if (!q || q.length < 2) return;

  const body = JSON.stringify({
    query:       q,
    surface:     input.surface,
    mode:        input.mode ?? "text",
    resultCount: input.resultCount,
  });

  /* sendBeacon is the right tool here — designed for fire-and-forget
     analytics during pagehide. Survives client-side route changes
     where a fetch could be cancelled. Falls back to fetch when
     unsupported (older browsers, some embedded webviews). */
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/log-search", blob);
      return;
    }
  } catch { /* fall through to fetch */ }

  try {
    void fetch("/api/log-search", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch { /* silent — logging must never break UX */ }
}
