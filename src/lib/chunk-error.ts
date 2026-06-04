/* Stale-chunk recovery.

   When a new build deploys, a browser still holding the previous page's
   HTML requests JS bundle hashes the new deploy deleted. Next.js surfaces
   this as a client-side exception ("Loading chunk N failed" on Chromium,
   "Importing a module script failed" on Safari/WebKit). It is transient:
   a full reload pulls the fresh bundle and the page works. These helpers
   let the error boundaries detect that case and self-heal with a single
   guarded reload, instead of showing the raw error screen. */

interface ErrLike {
  name?: string;
  message?: string;
}

export function isChunkLoadError(err?: ErrLike | null): boolean {
  const name = err?.name ?? "";
  const msg = err?.message ?? "";
  return (
    name === "ChunkLoadError" ||
    /loading chunk [\w-]+ failed/i.test(msg) ||
    /loading css chunk [\w-]+ failed/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) || // Safari / WebKit
    /error loading dynamically imported module/i.test(msg)
  );
}

/* Auto-recover from a stale-chunk error with ONE full reload. Guarded by
   sessionStorage so a genuine (non-chunk) error that recurs after reload
   falls through to the visible fallback instead of looping. Returns true
   when a reload was triggered (caller should stop rendering work). */
export function reloadOnceForChunkError(err?: ErrLike | null): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(err)) return false;
  const KEY = "havlo-chunk-reloaded";
  try {
    if (!window.sessionStorage.getItem(KEY)) {
      window.sessionStorage.setItem(KEY, "1");
      window.location.reload();
      return true;
    }
  } catch {
    /* sessionStorage can throw in private mode / blocked storage; if so,
       do a best-effort single reload guarded by a window flag instead. */
    const w = window as unknown as { __havloChunkReloaded?: boolean };
    if (!w.__havloChunkReloaded) {
      w.__havloChunkReloaded = true;
      window.location.reload();
      return true;
    }
  }
  return false;
}
