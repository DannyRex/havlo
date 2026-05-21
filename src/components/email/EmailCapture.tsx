"use client";

/* Email capture component — single-input newsletter signup. Posts
   to Havlo's own /api/newsletter endpoint by default which writes
   to the newsletter_subscribers table and fires a welcome email via
   Resend. Can be overridden via NEXT_PUBLIC_NEWSLETTER_FORM_URL or
   the `endpoint` prop if you ever need to point at Buttondown /
   Loops / Formspree.

   Why now: every visitor who lands on Havlo and bounces is lost
   forever. With email capture, even pre-launch traffic compounds
   into an asset (newsletter sponsorships at ~5k subscribers,
   reactivation campaigns, deal-of-the-day distribution, and
   stronger applications when re-applying to aggregators that
   gated us by traffic).

   Design intent: pill-shaped composite input + button matching
   the SearchBar / Hero composer aesthetic so it reads as native
   to Havlo. Inline state (idle / submitting / ok / error). No
   modal, no popup — embedded in the CTA section of the homepage.
*/

import { useState, type FormEvent } from "react";
import { Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";
import { useCountry } from "@/components/providers/CountryProvider";

interface Props {
  /** Override endpoint at the call site (e.g. for an A/B test or a
      different list). When omitted, reads from
      NEXT_PUBLIC_NEWSLETTER_FORM_URL. */
  endpoint?: string;
  /** Optional list/tag identifier passed to the backend. Lets one
      endpoint receive captures from multiple surfaces (homepage,
      blog footer, deal-page popup) and segment them later. */
  source?: string;
  /** Heading copy override. Default suits the homepage. */
  heading?: string;
  /** Subheading copy override. */
  subheading?: string;
}

type Status = "idle" | "submitting" | "ok" | "error";

export default function EmailCapture({
  endpoint,
  source = "homepage",
  heading = "Get the best deals we find each day.",
  subheading = "One short email, no spam, unsubscribe with a click.",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  /* Subscriber's country — sent with the signup so the welcome
     email links to their own /{country}/deals. Without this the
     /api/newsletter route had no country and fell back to /ng (a UK
     signup got an ng/deals link). */
  const { country } = useCountry();

  /* Default to the in-house /api/newsletter route. The mailto
     fallback was firing for every signup because the env var was
     never set, so users saw their mail app open instead of the
     success state. */
  const resolvedEndpoint = endpoint
    ?? process.env.NEXT_PUBLIC_NEWSLETTER_FORM_URL
    ?? "/api/newsletter";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrorMsg("That email address doesn't look right.");
      return;
    }

    try {
      const res = await fetch(resolvedEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: trimmed, source, country: country.code }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }
      /* Analytics fire-and-forget. Branch the event by source so we
         can read newsletter vs cashback waitlist separately in GA4
         without keeping two hooks. The email itself is never sent
         (the analytics wrapper strips PII by virtue of typed props
         not including an email field). */
      if (source === "cashback-waitlist") {
        track({ name: "cashback_waitlist_join", props: { source } });
      } else {
        track({
          name: "newsletter_subscribe",
          props: {
            surface: (source === "footer" || source === "blog") ? source : "homepage",
          },
        });
      }
      setStatus("ok");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Couldn't subscribe. Try again?");
    }
  }

  if (status === "ok") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-success/30 bg-success/10 p-5 sm:p-6 flex items-start gap-3 max-w-xl"
      >
        <Check className="text-success shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-ink font-semibold mb-1">You&apos;re in.</p>
          <p className="text-ink-2 text-sm leading-relaxed">
            Check your inbox. Your deals digest lands every Monday and Thursday.
          </p>
        </div>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <div className="max-w-xl">
      {(heading || subheading) && (
        <div className="mb-4">
          {heading && (
            <p className="text-base sm:text-lg font-semibold text-ink leading-snug">
              {heading}
            </p>
          )}
          {subheading && (
            <p className="text-sm text-ink-2 mt-1.5 leading-relaxed">
              {subheading}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="relative flex items-center bg-surface border border-border-strong rounded-full focus-within:border-brand focus-within:shadow-input transition-all">
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
            placeholder="you@example.com"
            aria-label="Email address"
            className="flex-1 min-w-0 px-5 py-3.5 bg-transparent text-ink placeholder:text-ink-3 text-base outline-none rounded-full"
            style={{ fontSize: "16px" }} // prevents iOS zoom on focus
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            aria-label="Subscribe"
            className={`m-1.5 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-semibold h-10 w-10 sm:w-auto sm:px-4 transition-all ${
              submitting || !email.trim()
                ? "bg-ink/10 text-ink-3 cursor-not-allowed"
                : "bg-ink text-bg hover:opacity-90 active:scale-95"
            }`}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <ArrowRight size={16} className="sm:hidden" strokeWidth={2.5} />
                <span className="hidden sm:inline">Subscribe</span>
              </>
            )}
          </button>
        </div>

        {status === "error" && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 text-sm text-red-500"
          >
            <AlertTriangle className="shrink-0 mt-0.5" size={14} />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
}
