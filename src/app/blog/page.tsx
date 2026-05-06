/* /blog — legacy URL. Redirects to /{cookie-country}/blog so the
   user lands on the country-canonical index. The country-prefixed
   route is the source of truth (per the same pattern as /deals
   and /compare). Keeping this redirect rather than deleting so any
   indexed /blog links Google has already cached send visitors to
   the right place instead of 404ing. */

import { redirect } from "next/navigation";
import { getServerCountry } from "@/lib/country-server";

export default function LegacyBlogIndex() {
  const country = getServerCountry();
  redirect(`/${country.code}/blog`);
}
