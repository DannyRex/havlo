"use client";

/* Cashback waitlist form — POSTs to /api/cashback-waitlist with
   inline state (loading / success / error). Phase 1 surface; Phase
   2 will replace this with the actual sign-up flow once auth is
   wired in.

   Why a separate client component (vs inline form on the server-
   rendered explainer page): we need useState for the success / error
   state. Keeping this as its own client component lets the parent
   stay server-rendered (better for metadata + initial paint). */

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  /** ISO 3166-1 alpha-2 lowercase. Stored alongside the email so we
      know which market each waitlist signup is from. */
  country: string;
}

type Status = "idle" | "submitting" | "ok" | "error";

export default function WaitlistForm({ country }: Props) {
  const [status, setStatus]     = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email")?.toString().trim();
    if (!email) {
      setStatus("error");
      setErrorMsg("Email required.");
      return;
    }

    /* Verbose error handling: distinguish between
         (a) fetch never reached the server (offline / DNS / aborted)
         (b) server returned non-OK status with HTML body (5xx error page)
         (c) server returned OK but body wasn't parseable JSON
         (d) server returned JSON with ok:false
       The previous catch-all 'Network error' message lumped (a)-(c)
       together which made debugging impossible. */
    try {
      let res: Response;
      try {
        res = await fetch("/api/cashback-waitlist", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email, country, source: "cashback-page" }),
        });
      } catch (err) {
        /* (a) — fetch itself threw. Genuinely network-level. */
        setStatus("error");
        setErrorMsg(`Couldn't reach the server. Check your connection and try again. (${(err as Error).message})`);
        return;
      }

      if (!res.ok) {
        /* (b) — server returned 4xx/5xx. Try to read body for context
           but don't crash if it's an HTML error page. */
        let bodyHint = "";
        try {
          const txt = await res.text();
          bodyHint = txt.length > 0 ? ` (${txt.slice(0, 100)})` : "";
        } catch { /* ignore */ }
        setStatus("error");
        setErrorMsg(`Server returned ${res.status}.${bodyHint} Try again in a moment.`);
        return;
      }

      let data: { ok?: boolean; error?: string };
      try {
        data = await res.json();
      } catch {
        /* (c) — response wasn't valid JSON. Vercel sometimes returns
           HTML on edge-runtime crashes; surface a clearer hint. */
        setStatus("error");
        setErrorMsg("Server response wasn't readable. Try again in a moment.");
        return;
      }

      if (!data.ok) {
        /* (d) — server explicitly said it failed. */
        setStatus("error");
        setErrorMsg(data.error ?? "Could not save your signup.");
        return;
      }

      setStatus("ok");
      e.currentTarget.reset();
    } catch (err) {
      /* Defensive fallthrough — should never hit since each branch
         above sets status itself, but guards against future code
         changes accidentally re-introducing the silent error. */
      setStatus("error");
      setErrorMsg(`Unexpected error: ${(err as Error).message}`);
    }
  }

  if (status === "ok") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-success/30 bg-success/10 p-5 sm:p-6 flex items-start gap-3"
      >
        <Check className="text-success shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-ink font-semibold mb-1">You&apos;re on the list.</p>
          <p className="text-ink-2 text-sm leading-relaxed">
            We&apos;ll email you the moment cashback launches. Until then, keep
            shopping through Havlo and the rates above will apply retroactively
            to clicks made while you&apos;re signed up at launch.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3" noValidate>
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="flex-1 px-4 py-3 rounded-full bg-bg border border-border-strong text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-shadow"
        style={{ fontSize: "16px" }}
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
      >
        {status === "submitting" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Saving…
          </>
        ) : (
          <>
            Join the waitlist
            <ArrowRight size={16} />
          </>
        )}
      </button>
      {status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 sm:basis-full"
        >
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-ink-2">{errorMsg}</p>
        </div>
      )}
    </form>
  );
}
