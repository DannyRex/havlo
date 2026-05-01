"use client";

/* Cookie consent banner — required for EU markets (UK, DE) under
   the GDPR + ePrivacy directive. Renders only when no choice has
   been stored in localStorage. Triggers a custom 'havlo-consent-
   change' event so the analytics + affiliate scripts can self-gate.

   Design intent:
     Bottom-fixed slim panel, full-width on mobile (with safe-area
     padding), max-w-4xl on desktop. Matches Havlo's existing
     surface / border / ink token system so it feels native to the
     site rather than a third-party widget. Two clear actions
     (Reject / Accept) with no dark patterns: Reject is a real
     option, equally weighted visually, no "Reject All" buried in
     a sub-menu. Privacy policy link inline.

   Compliance posture:
     - No tracking before consent (GA + Skimlinks are gated client-
       side via the same consent state)
     - Consent stored with timestamp for record-keeping if ever
       needed for a regulator response
     - User can change their mind by clearing localStorage; future
       work could surface a "Cookie settings" link in the footer
*/

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "havlo-cookie-consent";
const CONSENT_TIMESTAMP_KEY = "havlo-cookie-consent-at";

export type ConsentState = "accepted" | "rejected";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    /* Read once on mount. SSR returns null body so there's no
       hydration mismatch (initial client render also shows nothing,
       then this effect bumps the state). */
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setShow(true);
  }, []);

  function setConsent(value: ConsentState) {
    if (typeof window === "undefined") return;
    localStorage.setItem(CONSENT_KEY, value);
    localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString());
    /* Custom event so GoogleAnalytics + Skimlinks components mounted
       elsewhere in the tree can react in the same tick. */
    window.dispatchEvent(
      new CustomEvent("havlo-consent-change", { detail: value }),
    );
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      /* pb-safe handles iOS home-indicator gap so the panel doesn't
         get visually swallowed by the bottom inset. */
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-6 animate-fade-up"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-4xl bg-surface border border-border-strong rounded-2xl shadow-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] sm:text-sm text-ink leading-relaxed">
              We use cookies to make Havlo work, understand how the site
              gets used, and earn commissions on retailer clicks at no
              extra cost to you. Read our{" "}
              <Link
                href="/privacy-policy"
                className="text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink whitespace-nowrap"
              >
                privacy policy
              </Link>
              .
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setConsent("rejected")}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-full text-sm font-semibold text-ink-2 hover:text-ink hover:bg-surface-2 border border-border-strong transition-colors"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => setConsent("accepted")}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-full text-sm font-semibold bg-ink text-bg hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers used by GA4 + Skimlinks components to self-gate ──── */

/** Read current consent state. Returns null until the banner has
    been answered. SSR-safe (returns null on server). */
export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "accepted" || v === "rejected") return v;
  return null;
}

/** Subscribe to consent changes. Returns a cleanup fn for useEffect. */
export function onConsentChange(cb: (v: ConsentState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent).detail as ConsentState);
  window.addEventListener("havlo-consent-change", handler);
  return () => window.removeEventListener("havlo-consent-change", handler);
}
