/* Bare-domain homepage — havlo.io/

   PREVIOUSLY: this route was noindex + a geo 307 redirect to /{country},
   so the bare brand domain could never be indexed (only /ng, /uk, … were).
   For a brand search like "havlo" there was no indexable homepage at the
   root, which hurt brand ranking.

   NOW: `/` renders a REAL, indexable homepage — the NG market, which is
   Havlo's primary market AND the hreflang x-default — with a self-canonical
   to https://havlo.io/. Country-specific bare paths (/deals, /compare, …)
   still geo-redirect via middleware; only the bare `/` renders. A visitor
   who wants another market switches with the country picker (which
   navigates to /uk, /us, …).

   Why this is safe (hydration): the root layout's CountryProvider passes no
   initialCode, so at `/` it resolves to the NG default — the SAME country we
   render here — so the prop-driven sections and the country context agree on
   the server and the client's first paint. (The original "havlo.io/ indexed
   with /us metadata" bug is gone a different way: the metadata below is a
   FIXED brand/NG block, not the geo-dependent target of a redirect.) */

import type { Metadata } from "next";
import HomePage from "./[country]/page";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";

/* ISR — mirror the country homepage's window so the bare domain stays a
   cheap static render. */
export const revalidate = 300;

export const metadata: Metadata = {
  /* Absolute (bypasses the layout's "%s · Havlo" template) so the brand
     leads the SERP title for "havlo" queries. */
  title: { absolute: "Havlo · Find similar products for less" },
  description:
    "Before you buy it, find it for less. Havlo compares prices across the stores you already shop, so you never overpay online.",
  alternates: {
    /* Self-canonical to the bare domain so Google indexes havlo.io/ as the
       homepage. buildHreflangAlternates now emits x-default → / for the
       homepage cluster (see lib/seo.ts). */
    canonical: `${SITE_URL}/`,
    languages: buildHreflangAlternates(""),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    title: "Havlo · Find similar products for less",
    description:
      "Before you buy it, find it for less. Havlo compares prices across the stores you already shop.",
    url: `${SITE_URL}/`,
    siteName: "Havlo",
  },
};

export default function RootHome() {
  /* Reuse the country homepage rendered for NG. country="ng" matches the
     root CountryProvider's default, so the prop-driven sections (NG deals,
     NGN prices) and the country context stay consistent. */
  return <HomePage params={{ country: "ng" }} />;
}
