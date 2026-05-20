/* ──────────────────────────────────────────────────────────────────
   Lightweight in-memory rate limiter.

   Fixed-window counter keyed by an arbitrary string (usually IP +
   route). State is module-level, so it is PER Vercel function
   instance — a first line of defence against a single client
   hammering a warm instance, not a distributed guarantee. The
   robust upgrade is a shared store (Vercel KV / Upstash); this
   needs zero infra and zero dependencies.

   Used to cap the unauthenticated paid endpoints — /api/live-search
   burns SerpAPI credits, /api/sniff burns an OpenAI call — so a
   flood can't drain the monthly budget.
   ────────────────────────────────────────────────────────────────── */

interface Window { count: number; resetAt: number; }

const windows = new Map<string, Window>();

/* Returns true when the call is ALLOWED, false when it should be
   rejected with a 429. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    /* Opportunistic sweep so the Map can't grow unbounded under a
       wide-IP flood. forEach (not for-of) — the project's tsconfig
       targets es2017 without downlevelIteration. */
    if (windows.size > 5000) {
      windows.forEach((v, k) => { if (v.resetAt <= now) windows.delete(k); });
    }
    return true;
  }
  if (w.count >= limit) return false;
  w.count++;
  return true;
}

/* Best-effort client IP from the standard proxy headers Vercel sets
   on every incoming request. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
