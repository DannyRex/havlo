/* Root redirect — sends users to /{their-country}/.
   Reads the cookie if set; otherwise lands on the NG default.

   Metadata: noindex + canonical to /uk (most common English market).

   Why noindex: Google was crawling havlo.io/ from US data centres,
   following the geo-IP redirect to /us, and then indexing the BARE
   havlo.io URL with /us page metadata. UK searchers Googling the
   site name then saw "Find similar products for less in United
   States" under havlo.io. QA report May 2026.

   Fix: tell Google not to index the bare URL at all. Each
   /[country]/ page is its own canonical (already set in
   [country]/page.tsx metadata) with hreflang alternates pointing
   to all 7 country variants. Google routes the right one to each
   user. The bare havlo.io stays a courtesy redirect for humans
   (cookie/geo aware) but doesn't confuse the index. */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerCountry } from "@/lib/country-server";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function RootIndex() {
  const country = getServerCountry();
  redirect(`/${country.code}`);
}
