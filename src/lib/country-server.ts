/* Server-only country helpers.
   Imports next/headers — must NOT be touched by client components.
   See src/lib/country.ts for the data + client-safe helpers. */

import "server-only";
import { cookies } from "next/headers";
import { COUNTRY_COOKIE, getCountry, type Country } from "./country";

/** Read the user's country from the cookie in a Server Component.
    Falls back to DEFAULT_COUNTRY when unset or unrecognised. */
export function getServerCountry(): Country {
  const raw = cookies().get(COUNTRY_COOKIE)?.value;
  return getCountry(raw);
}
