"use client";

/* /deals category subscribe widget.

   Renders inline above the deal grid whenever the user has narrowed
   to a specific category. Lets shoppers say "I only want Phones
   deals — email me when there's something good." Different from the
   homepage NewsletterStrip in three ways:

     1. Tied to the active category (`?category=phones` URL param).
     2. Compact / inline — single row of contextual UI, not a
        fullscreen marketing strip. Doesn't break the browse flow.
     3. Persists the chosen category server-side via /api/newsletter
        with the `category` field, so the eventual daily-send job
        (Phase 2 of the newsletter pipeline) can branch on it.

   UX:
     • Idle state shows email input + Subscribe button + small
       reassurance line.
     • Submitting → button shows spinner.
     • OK → swap to a single-line "Done. We'll email you when there's
       a fresh Phones deal." confirmation.
     • Error → red helper text under the input, retry stays visible.

   A11y:
     • Label association on the input via htmlFor / id.
     • aria-live="polite" on the status region so screen readers
       announce success/error.
     • role="status" on confirmation. */

import { useState, type FormEvent } from "react";
import { Mail, Check, Loader2 } from "lucide-react";
import { useCountry } from "@/components/providers/CountryProvider";
import { track } from "@/lib/analytics";

interface Props {
  /** Category slug from /deals filter — pre-validated by the caller
      against the categories.ts list (won't render for invalid slugs). */
  categorySlug: string;
  /** Display name for the category, used in the heading + confirmation. */
  categoryName: string;
  /** Optional accent colour from categories.ts. When set, renders the
      category name in that hue. The previous brand-blue accent felt
      off on dark backgrounds — using the category's own colour gives
      each filter its own identity (purple Phones, orange Audio, pink
      Fashion, etc.) and avoids the low-contrast blue-on-dark issue. */
  categoryColor?: string;
}

type Status = "idle" | "submitting" | "ok" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CategorySubscribe({ categorySlug, categoryName, categoryColor }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { country } = useCountry();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setErrorMsg("That email address doesn't look right.");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:    trimmed,
          source:   `deals-${categorySlug}`,
          country:  country?.code,
          category: categorySlug,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }
      setStatus("ok");
      setEmail("");
      /* Analytics — same wrapper used elsewhere. Reuses the
         newsletter_subscribe event with surface=blog as the closest
         existing match; the source string is still distinct in GA4
         so the segment is recoverable. */
      track({
        name: "newsletter_subscribe",
        props: { surface: "homepage", country: country?.code },
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Could not subscribe. Try again?");
    }
  }

  /* Confirmation state — single-line replacement that doesn't shove
     the deal grid down. Same vertical footprint as the form. */
  if (status === "ok") {
    return (
      <div
        role="status"
        className="my-4 sm:my-5 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-success/30 bg-success/10 text-[13px] text-ink-2"
      >
        <Check size={16} className="text-success shrink-0" />
        <span>
          Done. We&apos;ll email you when there&apos;s a fresh{" "}
          <strong className="text-ink">{categoryName}</strong> deal worth opening.
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="my-4 sm:my-5 rounded-xl border border-border bg-surface px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3"
      aria-labelledby="category-subscribe-heading"
    >
      <Mail size={18} className="hidden sm:block shrink-0 text-ink-3" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p
          id="category-subscribe-heading"
          className="text-[13px] sm:text-sm font-semibold text-ink leading-snug"
        >
          Want fresh{" "}
          <span style={categoryColor ? { color: categoryColor } : undefined} className="font-bold">
            {categoryName}
          </span>{" "}
          deals in your inbox?
        </p>
        <p className="text-[11px] sm:text-[12px] text-ink-3 mt-0.5">
          Two emails a week, Monday and Thursday. Unsubscribe in one click.
        </p>
      </div>

      <div className="flex w-full sm:w-auto items-center gap-2 shrink-0">
        <label htmlFor="category-subscribe-email" className="sr-only">
          Email address
        </label>
        <input
          id="category-subscribe-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          disabled={status === "submitting"}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "category-subscribe-error" : undefined}
          /* text-base on mobile (16px) prevents iOS Safari auto-zoom
             on focus — anything smaller triggers the viewport zoom.
             sm:text-[13px] restores the compact look on tablet+
             where there's no zoom hazard. Same pattern the /deals
             search input uses (DealFeed.tsx:271-272). */
          className="flex-1 sm:w-56 h-9 px-3 rounded-lg border border-border bg-bg text-base sm:text-[13px] text-ink placeholder:text-ink-3/70 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="h-9 px-3 sm:px-4 rounded-lg bg-ink text-bg text-[13px] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 active:opacity-80 disabled:opacity-60 transition-opacity"
        >
          {status === "submitting" ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              <span>Adding…</span>
            </>
          ) : (
            <span>Subscribe</span>
          )}
        </button>
      </div>

      {status === "error" && (
        <p
          id="category-subscribe-error"
          aria-live="polite"
          className="w-full text-[12px] text-error font-medium"
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}
