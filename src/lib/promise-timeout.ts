/* Promise timeout wrapper.

   Wraps any promise in a Promise.race against a timer so a single
   slow dependency (Supabase RPC, OpenAI completion, external API)
   can't push the calling request past Vercel's 30s function
   timeout. A graceful timeout returns a fallback instead of
   throwing — the caller decides what "no result" means for the
   surface (empty list, null, etc.).

   Usage:
     const { data } = await withTimeout(
       supa.rpc("browse_deals", args),
       1500,
       { data: [], error: null },
     );

   When to use:
     • Any Supabase RPC on a user-blocking path (browse, search,
       compare, PDP render).
     • Any LLM / vector / external API call that could hang.

   When NOT to use:
     • Cron jobs and ingestion workers — let those finish or fail
       loudly so the operator notices.
     • Health checks — they want the real latency, not a
       short-circuit. */

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  /* Optional name for log breadcrumbs when the timeout fires.
     Helps differentiate which RPC is hanging during incidents. */
  name?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      if (name) {
        console.warn(`[withTimeout] ${name} timed out after ${ms}ms — using fallback`);
      }
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
