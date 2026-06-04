"use client";

/* Route-segment error boundary. Catches client-side exceptions thrown
   anywhere under the root layout (homepage, deals, PDP, compare, ...)
   and shows a branded fallback instead of Next's raw white-screen
   "Application error". The root layout (nav, theme, globals.css) stays
   mounted, so Tailwind tokens render correctly here.

   Stale-chunk errors after a deploy self-heal with one reload (see
   chunk-error.ts); anything else shows the fallback with a reload + home
   action. */

import { useEffect } from "react";
import Link from "next/link";
import { reloadOnceForChunkError } from "@/lib/chunk-error";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (reloadOnceForChunkError(error)) return;
    // Surface for debugging; wire to an error sink (Sentry etc.) if added.
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 bg-bg">
      <div className="max-w-md text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em] mb-2">
          Something went wrong
        </h1>
        <p className="text-ink-2 text-[15px] leading-relaxed mb-6">
          That page hit an unexpected error. Reloading usually fixes it, we may
          have just shipped an update.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Reload
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-3 rounded-full border border-border-strong text-ink font-semibold text-sm hover:bg-surface-2 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
