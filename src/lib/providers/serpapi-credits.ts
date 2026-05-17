/* ──────────────────────────────────────────────────────────────────
   SerpAPI credit guard.

   Used by ingest crons (especially the monthly market lane) to abort
   gracefully when the account is low on plan searches. Without this
   guard a cron that runs at the wrong time can consume the user's
   remaining credits silently and leave the rest of the month with no
   live-search budget for user-facing queries.

   API: SerpAPI exposes account state at
     GET https://serpapi.com/account?api_key=...
   Response includes:
     - plan_searches_left           remaining for current plan period
     - extra_credits                top-up credits available
     - this_hour_searches           rate-limit window counter
     - total_searches_left          plan + extra

   We treat total_searches_left as the authoritative budget.
   ────────────────────────────────────────────────────────────────── */

const ACCOUNT_ENDPOINT = "https://serpapi.com/account.json";

export interface SerpapiAccount {
  totalLeft:    number;
  planLeft:     number;
  extraLeft:    number;
  planName:     string;
  thisHour:     number;
  rawResponse?: unknown;
}

export async function fetchSerpapiAccount(apiKey: string): Promise<SerpapiAccount> {
  const url = new URL(ACCOUNT_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString(), {
    /* No caching — we want a live read every time the cron asks. */
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`SerpAPI account check failed: HTTP ${res.status}`);
  }
  const data = await res.json() as Record<string, unknown>;
  const planLeft  = typeof data["plan_searches_left"]  === "number" ? data["plan_searches_left"]  : 0;
  const extraLeft = typeof data["extra_credits"]       === "number" ? data["extra_credits"]       : 0;
  const totalLeft = typeof data["total_searches_left"] === "number" ? data["total_searches_left"] : (planLeft + extraLeft);
  const planName  = typeof data["plan_name"]           === "string" ? data["plan_name"]           : "unknown";
  const thisHour  = typeof data["this_hour_searches"]  === "number" ? data["this_hour_searches"]  : 0;
  return { totalLeft, planLeft, extraLeft, planName, thisHour, rawResponse: data };
}

/** Returns true when there's enough budget to run the planned ingest.
    Adds a safety buffer so we never zero out credits in a single run
    (leaves headroom for user-facing live-search calls during the
    rest of the period). */
export function hasBudget(
  account: SerpapiAccount,
  plannedCalls: number,
  bufferFraction: number = 0.5,
): boolean {
  const buffer = Math.ceil(plannedCalls * bufferFraction);
  return account.totalLeft >= plannedCalls + buffer;
}
