/* Root-level default OG card. Auto-inherits to every route that
   doesn't have its own opengraph-image.tsx (legal pages, /contact,
   /[country]/cashback, /[country]/blog/[slug], etc.).

   Refactored May 2026 v3 to use the shared OgShell component —
   matches the other ~7 OG surfaces.

   Jun 2026: the "stores" badge is now LIVE from the DB (was nothing on
   this country-agnostic card, and a hardcoded "1,700+" on the country
   card). Shows the integrated store-registry size — the universe of
   stores Havlo compares across — since a shared havlo.io link has no
   country in scope. Node runtime so the Supabase count is reliable;
   ISR-cached an hour. 1200×630 PNG. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";
import { getGlobalShoppableStoreCount } from "@/lib/providers/browse-db";

export const runtime    = "nodejs";
export const revalidate = 3600;
export const alt        = "Havlo · Find similar products for less";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default async function DefaultOG() {
  const count = await getGlobalShoppableStoreCount().catch(() => 0);
  /* Round DOWN to a clean figure so the "+" is always honest. */
  const rounded = Math.floor(count / 500) * 500;
  return new ImageResponse(
    (
      <OgShell
        headline="Find similar products"
        subline="for less."
        subhead="Paste a link or search anything. Cheaper alternatives across the stores you already know."
        statusDot={rounded >= 500 ? { color: "#22C55E", text: `${rounded.toLocaleString()}+ stores worldwide` } : null}
      />
    ),
    size,
  );
}
