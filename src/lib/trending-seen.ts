/* Per-country "recently-seen" memory for in-memory browse feeds — currently the
   Amazon deals browser, which holds its whole offer set client-side. It SOFT-
   deprioritises recently-seen products (pushes them to the BACK of the default
   "Recommended" order) so each visit leads with fresh inventory, but nothing is
   hidden: everything stays reachable by scrolling or switching sort. This is the
   browse-feed sibling of the homepage trending grid's per-visit rotation (which
   HARD-excludes from a fixed 16-card pick and keeps its own window key).

   Why only the in-memory feeds: /deals is a CDN-cached, server-paginated feed
   already rotated ~10-min by its ISR seed — per-visit exclusion there would need
   a per-user exclude/seed and fragment the shared /api/deals cache (cost), so it
   keeps its existing rotation instead.

   Window-level TTL (one timestamp from when the window began), not per-item, to
   keep the payload tiny. The window resets only after SEEN_TTL_MS from its
   start, so a return visit hours (or a day or two) later still skips what was
   already seen; the FIFO cap is what re-circulates the catalogue for active
   users, so nothing is excluded forever even within a window. All client-side;
   every access is guarded (private mode / quota / malformed -> fresh window). */

const SEEN_TTL_MS = 72 * 60 * 60 * 1000; // window lives ~3 days from its first visit
const SEEN_CAP    = 200;                 // browse feeds reveal a lot — remember more than the 16-card grid
const SEEN_TRIM   = 140;                 // FIFO-trim to this when the cap is hit, so the catalogue keeps headroom

const seenKey = (cc: string) => `havlo:seen:${cc}`;

interface SeenWindow { version: number; windowStart: number; dealIds: string[] }

/* Read the active window. Returns a FRESH window (empty, windowStart=now) when
   storage is empty, malformed, unavailable, or aged out. */
export function readSeen(cc: string, now: number): { windowStart: number; ids: string[] } {
  try {
    const raw = localStorage.getItem(seenKey(cc));
    if (raw) {
      const w = JSON.parse(raw) as Partial<SeenWindow>;
      if (
        typeof w.windowStart === "number" &&
        now - w.windowStart < SEEN_TTL_MS &&
        Array.isArray(w.dealIds)
      ) {
        return { windowStart: w.windowStart, ids: w.dealIds.filter((x): x is string => typeof x === "string") };
      }
    }
  } catch { /* private mode / parse error — treat as a fresh window */ }
  return { windowStart: now, ids: [] };
}

/* Append the just-shown ids to the window (FIFO, capped), preserving the
   window's start so the TTL measures from first activity. Pass the windowStart
   you got from readSeen. */
export function recordSeen(cc: string, windowStart: number, priorIds: string[], shownIds: string[]): void {
  try {
    const shown = new Set(shownIds);
    const merged = [...priorIds.filter((id) => !shown.has(id)), ...shownIds];
    const capped = merged.length > SEEN_CAP ? merged.slice(merged.length - SEEN_TRIM) : merged;
    localStorage.setItem(
      seenKey(cc),
      JSON.stringify({ version: 1, windowStart, dealIds: capped } as SeenWindow),
    );
  } catch { /* private mode / quota — silent no-op */ }
}

/* Soft-deprioritise: stable-partition so NOT-recently-seen items lead and
   recently-seen fall to the back, preserving the input order within each group.
   For browse feeds (Amazon / deals) where everything stays reachable. */
export function freshFirst<T>(items: T[], idOf: (item: T) => string, seen: Set<string>): T[] {
  if (seen.size === 0) return items;
  const fresh: T[] = [];
  const stale: T[] = [];
  for (const it of items) (seen.has(idOf(it)) ? stale : fresh).push(it);
  return fresh.concat(stale);
}
