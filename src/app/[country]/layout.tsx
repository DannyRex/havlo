/* Country segment validator + nested CountryProvider seed.

   Two responsibilities:
     1. 404 on unsupported country codes (`/xyz/deals` should not render).
     2. Wrap the segment in a nested CountryProvider seeded with the
        URL country, so client components below see the correct
        country in their initial state — no flash, no /ng/p/ prefix
        leaking into SSR'd /uk/p/ links.

   IMPORTANT: this layout intentionally has NO cookies() / headers()
   reads. The previous version called cookies() to sync the country
   cookie with the URL, but ANY cookies() call in the render tree
   forces every page below it to render dynamically — which defeated
   the revalidate=1800 ISR declared on the homepage. May 2026 perf
   investigation traced /[country]/ being uncached
   (`x-vercel-cache: MISS`, `private, no-cache, no-store`) to that
   single cookies() call.

   The cookie sync the old version did was redundant anyway:
   CountryProvider's URL-first hydration (see its useEffect) reads
   the URL pathname on mount and sets the client-side cookie via the
   picker if the user explicitly changes country. The middleware
   handles bare-path → country-prefixed redirects using the cookie.
   No server-side cookie write is needed. */

import { notFound } from "next/navigation";
import { CountryProvider } from "@/components/providers/CountryProvider";
import { COUNTRIES } from "@/lib/country";

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

export default function CountryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params:   { country: string };
}) {
  const code = params.country?.toLowerCase();
  if (!code || !COUNTRIES.some((c) => c.code === code)) notFound();

  /* Nested CountryProvider with initialCode = URL country. Overrides
     the root layout's default-country provider for everything inside
     /[country]/. So /uk/deals SSR'd cards link to /uk/p/..., not
     /ng/p/... (the bug before this layout existed — useCountry()'s
     server-side value defaulted to NG). */
  return <CountryProvider initialCode={code}>{children}</CountryProvider>;
}
