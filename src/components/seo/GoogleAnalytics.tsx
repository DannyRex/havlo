/* Google Analytics 4 — gated on NEXT_PUBLIC_GA_ID so it stays
   completely invisible until the env var is populated. No-op render
   means no script tag, no network calls, zero perf impact pre-launch.

   We use Next.js's <Script> with strategy="afterInteractive" so GA
   doesn't block first paint or interactivity. Standard GA4 install.

   Once you set NEXT_PUBLIC_GA_ID=G-XXXXXXX in Vercel + redeploy, this
   component renders the GA4 init + page-view tracking automatically.
   No further code change needed. */

import Script from "next/script";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

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
            /* Respect privacy by default; revisit when EU users need
               consent banner integration. */
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  );
}
