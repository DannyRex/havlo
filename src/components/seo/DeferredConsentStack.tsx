"use client";

/* Tiny client wrapper that lazy-loads the post-paint consent +
   tracking stack on the client only. This is the only piece that
   needs to be in the root layout's client tree; the heavier
   children mount via next/dynamic so they don't ship in the layout
   chunk.

   Why a wrapper instead of dynamic() directly in layout.tsx:
   next/dynamic with `ssr: false` requires a Client Component
   ancestor — the layout is a Server Component and Next refuses
   the ssr: false flag silently there. Hoisting the dynamic() calls
   into this client wrapper unlocks the split.

   What's lazy:
     • CookieConsent     — only renders for first-visit users
     • GoogleAnalytics   — no-op until consent + GA env var
     • Skimlinks         — no-op until consent

   Net: ~3-5 kB shaved off the first-load shared chunk every page
   pays. The cost is a tiny extra fetch on the client after first
   paint — all three components are post-paint by design, so the
   user never sees the delay. */

import dynamic from "next/dynamic";

const CookieConsent   = dynamic(() => import("./CookieConsent"),   { ssr: false });
const GoogleAnalytics = dynamic(() => import("./GoogleAnalytics"), { ssr: false });
const Skimlinks       = dynamic(() => import("./Skimlinks"),       { ssr: false });

export default function DeferredConsentStack() {
  return (
    <>
      <GoogleAnalytics />
      <Skimlinks />
      <CookieConsent />
    </>
  );
}
