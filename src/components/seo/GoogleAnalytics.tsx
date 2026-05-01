"use client";

/* Google Analytics 4 — gated on NEXT_PUBLIC_GA_ID AND on the user's
   cookie consent. Renders nothing until both are true:
     1. The env var is set (otherwise the install is a no-op pre-launch)
     2. The visitor has accepted cookies via the consent banner

   Why client-side gating: GA must not fire any network requests
   before the user opts in (GDPR / ePrivacy). Server-rendering the
   gtag init script would fire on first paint regardless of consent.
   By converting to a client component that subscribes to the
   consent state, scripts only mount after the Accept click.

   Once NEXT_PUBLIC_GA_ID is set in Vercel and the user accepts,
   this component renders the standard GA4 init + page-view
   tracking. No further code change needed.
*/

import Script from "next/script";
import { useEffect, useState } from "react";
import { readConsent, onConsentChange, type ConsentState } from "./CookieConsent";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    return onConsentChange(setConsent);
  }, []);

  if (!gaId) return null;
  if (consent !== "accepted") return null;

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  );
}
