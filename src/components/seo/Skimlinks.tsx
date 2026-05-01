"use client";

/* Skimlinks affiliate auto-monetization — gated on
   NEXT_PUBLIC_SKIMLINKS_ID AND on the user's cookie consent.
   Renders nothing until both are true.

   Why client-side gating: Skimlinks rewrites links and drops
   tracking cookies the moment its script loads. That counts as
   non-essential tracking under GDPR / ePrivacy, so loading the
   script before consent is not compliant in EU markets (UK, DE).
   Subscribing to the consent state keeps Skimlinks dormant until
   the user accepts.

   How Skimlinks works once active:
     The script walks the DOM after load, finds links to any of
     their ~48,500 supported retailers, and silently rewrites them
     with our affiliate parameters. Zero per-merchant work.

   Why lazyOnload: link rewriting can wait until the browser is
   idle. lazyOnload schedules via requestIdleCallback so it never
   competes with first-paint or interactivity work.

   Setup: NEXT_PUBLIC_SKIMLINKS_ID=302355X1790351 in Vercel envs.
*/

import Script from "next/script";
import { useEffect, useState } from "react";
import { readConsent, onConsentChange, type ConsentState } from "./CookieConsent";

export default function Skimlinks() {
  const id = process.env.NEXT_PUBLIC_SKIMLINKS_ID;
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    return onConsentChange(setConsent);
  }, []);

  if (!id) return null;
  if (consent !== "accepted") return null;

  return (
    <Script
      id="skimlinks"
      src={`https://s.skimresources.com/js/${id}.skimlinks.js`}
      strategy="lazyOnload"
    />
  );
}
