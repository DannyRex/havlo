/* Server-only country helpers.
   Imports next/headers — must NOT be touched by client components.
   See src/lib/country.ts for the data + client-safe helpers. */

import "server-only";
import { cookies, headers } from "next/headers";
import { COUNTRY_COOKIE, getCountry, COUNTRIES, type Country } from "./country";

/* Country code priority order:
     1. Explicit cookie (user clicked the country picker — highest signal)
     2. Vercel geo-IP header (x-vercel-ip-country) — first-visit auto-pick
        so a user landing from London doesn't see Naira prices by default
     3. Cloudflare-style header (cf-ipcountry) — useful when self-hosting
     4. DEFAULT_COUNTRY = "ng"

   Only auto-pick from a country we actually support — falling back to
   the default for unsupported regions keeps the catalog data sensible. */

const SUPPORTED_CODES = new Set(COUNTRIES.map((c) => c.code));

function inferFromGeoHeaders(): string | null {
  let h: ReturnType<typeof headers>;
  try {
    h = headers();
  } catch {
    return null; // outside a request context (build-time, etc.)
  }
  const candidates = [
    h.get("x-vercel-ip-country"),
    h.get("cf-ipcountry"),
  ].filter(Boolean) as string[];
  for (const raw of candidates) {
    const code = raw.toLowerCase();
    /* Vercel/CF use uppercase ISO codes including 'GB' for the UK; our
       internal id is 'uk' so we map the obvious cases. Add others as
       new countries get supported. */
    const remapped = code === "gb" ? "uk" : code;
    if (SUPPORTED_CODES.has(remapped)) return remapped;
  }
  return null;
}

/** Read the user's country from cookie → geo-IP → default.
    Falls back to DEFAULT_COUNTRY when no signal resolves. */
export function getServerCountry(): Country {
  const cookieRaw = cookies().get(COUNTRY_COOKIE)?.value;
  if (cookieRaw && SUPPORTED_CODES.has(cookieRaw.toLowerCase())) {
    return getCountry(cookieRaw);
  }
  const geoCode = inferFromGeoHeaders();
  if (geoCode) return getCountry(geoCode);
  return getCountry(undefined);
}
