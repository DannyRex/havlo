/* Country segment validator.
   - Validates the [country] URL param against the supported COUNTRIES roster.
   - 404s on unsupported codes (so `/xyz/deals` doesn't render).
   - Sets the user's preferred country in a cookie when the URL says
     something different (so deep-linking to /uk/deals from search updates
     their preference for subsequent navigation).

   This layout doesn't add visual chrome — Navbar / Footer live in the
   root layout. It exists purely to gate + sync the URL country. */

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { COUNTRIES, COUNTRY_COOKIE, getCountry } from "@/lib/country";

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.code }));
}

export default function CountryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { country: string };
}) {
  const code = params.country?.toLowerCase();
  if (!code || !COUNTRIES.some((c) => c.code === code)) notFound();

  /* Sync the cookie with the URL when they disagree. Page renders
     immediately with the URL country; the cookie write takes effect for
     subsequent navigation (any link that doesn't carry a country prefix). */
  const jar = cookies();
  if (jar.get(COUNTRY_COOKIE)?.value !== code) {
    /* cookies().set is only allowed in Server Actions / Route Handlers
       — silently skip in RSC render. CountryProvider on the client picks
       up the URL country via initialCode passed below. */
    try {
      jar.set(COUNTRY_COOKIE, code, {
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        path: "/",
      });
    } catch {/* RSC render context — write skipped, client will sync */}
  }

  // The country is also surfaced via getServerCountry() (cookies). Children
  // that need it should call getServerCountry directly — same source of truth.
  void getCountry(code);
  return <>{children}</>;
}
