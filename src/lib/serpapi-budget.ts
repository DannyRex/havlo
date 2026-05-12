/* Soft monthly cap on SerpAPI usage with graceful degradation.

   When live-search calls exceed 80% of the configured monthly cap,
   /api/live-search stops calling SerpAPI for the rest of the month
   and returns DB-only results instead. The 20% headroom absorbs:
     - Race-condition slop from the non-atomic increment (a few
       parallel calls may double-count or under-count by a couple)
     - Background ingest jobs (UK retailer ingest cron) that also
       hit SerpAPI and aren't gated by this counter
     - Manual one-off probes

   Calls are tracked in the serpapi_usage Supabase table (migration
   0017) keyed by month_key ('YYYY-MM'). Each row carries its own
   `cap` so we can adjust the limit mid-month without code changes.

   Failsafe: if Supabase is unreachable, withinBudget returns
   `allowed: true` so live search keeps working. We never want a
   DB outage to silently kill the live-search surface. The trade-
   off is that a DB outage could temporarily breach budget — worth
   the resilience for now. */

import { getSupabaseAdmin } from "@/lib/providers/db-client";

/* Default cap when no row exists in the DB. Override per-environment
   via SERPAPI_MONTHLY_CAP, override per-month by editing the row's
   cap column directly. 5000 matches the SerpAPI Starter plan
   default; bump if you upgrade. */
const DEFAULT_CAP = Number(process.env.SERPAPI_MONTHLY_CAP ?? 5000);

/* Soft threshold — when calls cross this fraction of cap, /api/live-
   search stops making new SerpAPI calls. 0.8 = 80% leaves 20%
   headroom for background ingest jobs that also consume credits. */
const SOFT_THRESHOLD = 0.8;

export interface BudgetStatus {
  allowed:   boolean;  // false when SOFT_THRESHOLD breached
  calls:     number;
  cap:       number;
  remaining: number;
  monthKey:  string;
}

/** Compute the current month key in UTC. SerpAPI invoices on UTC
    so we align here to avoid off-by-day errors. */
function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

/** Read the current month's usage and decide whether new SerpAPI
    calls should be allowed. Cheap (single indexed SELECT). */
export async function withinBudget(): Promise<BudgetStatus> {
  const monthKey = currentMonthKey();
  const supa = getSupabaseAdmin();
  if (!supa) {
    /* No Supabase → failsafe to "allowed." See module-level
       comment for rationale (never silently kill live search on
       DB outage). */
    return { allowed: true, calls: 0, cap: DEFAULT_CAP, remaining: DEFAULT_CAP, monthKey };
  }

  const { data, error } = await supa
    .from("serpapi_usage")
    .select("calls, cap")
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    console.warn("[serpapi-budget] read failed:", error.message);
    return { allowed: true, calls: 0, cap: DEFAULT_CAP, remaining: DEFAULT_CAP, monthKey };
  }

  const calls = data?.calls ?? 0;
  const cap   = data?.cap   ?? DEFAULT_CAP;
  return {
    allowed:   calls < cap * SOFT_THRESHOLD,
    calls,
    cap,
    remaining: Math.max(0, cap - calls),
    monthKey,
  };
}

/** Increment the counter for the current month. Fire-and-forget at
    the call site — increments are non-atomic (read → write) so
    parallel calls may lose a few, which is acceptable for a soft
    cap with 20% headroom. */
export async function recordSerpApiCall(n: number = 1): Promise<void> {
  const supa = getSupabaseAdmin();
  if (!supa) return;
  const monthKey = currentMonthKey();

  try {
    /* Atomic increment via the increment_serpapi_calls RPC defined
       in migration 0017. Falls back to a non-atomic upsert if the
       RPC isn't available (e.g. migration hasn't been applied yet,
       or we're hitting a stale schema mid-deploy). */
    const { error: rpcErr } = await supa.rpc("increment_serpapi_calls", {
      p_month_key: monthKey,
      p_n: n,
    });
    if (!rpcErr) return;

    /* Fallback: read-then-write upsert. Race-prone but fine for the
       soft cap; only fires when the RPC isn't installed. */
    const { data: existing } = await supa
      .from("serpapi_usage")
      .select("calls, cap")
      .eq("month_key", monthKey)
      .maybeSingle();
    const next = (existing?.calls ?? 0) + n;
    await supa.from("serpapi_usage").upsert(
      {
        month_key:  monthKey,
        calls:      next,
        cap:        existing?.cap ?? DEFAULT_CAP,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month_key" },
    );
  } catch (err) {
    console.warn("[serpapi-budget] increment failed:", (err as Error).message);
  }
}
