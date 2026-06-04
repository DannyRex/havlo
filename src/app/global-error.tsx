"use client";

/* Root error boundary. This is the LAST line of defence: it catches
   errors thrown in the root layout itself (where the segment-level
   error.tsx cannot reach). Next.js replaces the entire document with
   this component, so it must render its own <html>/<body> and cannot
   rely on the app's globals.css or theme provider -- hence the inline
   <style> with a prefers-color-scheme fallback so it stays legible in
   light and dark.

   Stale-chunk errors after a deploy self-heal with one reload. */

import { useEffect } from "react";
import { reloadOnceForChunkError } from "@/lib/chunk-error";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (reloadOnceForChunkError(error)) return;
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <style>{`
          .he-wrap{min-height:100vh;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#0f172a;}
          .he-card{max-width:420px;text-align:center;}
          .he-mark{font-weight:800;font-size:20px;letter-spacing:-0.02em;margin:0 0 24px;}
          .he-h1{font-size:21px;font-weight:700;margin:0 0 8px;letter-spacing:-0.02em;}
          .he-p{font-size:15px;line-height:1.55;color:#475569;margin:0 0 24px;}
          .he-btn{appearance:none;border:0;border-radius:999px;padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer;background:#0f172a;color:#ffffff;}
          @media (prefers-color-scheme: dark){
            .he-wrap{background:#0b1120;color:#e2e8f0;}
            .he-p{color:#94a3b8;}
            .he-btn{background:#e2e8f0;color:#0b1120;}
          }
        `}</style>
        <div className="he-wrap">
          <div className="he-card">
            <div className="he-mark">Havlo</div>
            <h1 className="he-h1">Something went wrong</h1>
            <p className="he-p">
              That page hit an unexpected error. Reloading usually fixes it, we
              may have just shipped an update.
            </p>
            <button
              className="he-btn"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
