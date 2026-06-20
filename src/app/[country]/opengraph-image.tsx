/* Country homepage OG card — 1200×630 PNG.
   Renders the Havlo wordmark on the dark zinc-950 panel that the rest
   of the site uses for its CTA + accent surfaces.

   Jun 2026: the "stores" badge is now LIVE from the DB (was a hardcoded
   "1,700+ stores worldwide"). It shows the same per-country shoppable
   store count the homepage Hero shows (getShoppableStoreCount), so a
   shared link's preview matches the page it opens. Node runtime so the
   Supabase count call is reliable; ISR-cached an hour to keep it cheap. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";
import { getShoppableStoreCount } from "@/lib/providers/browse-db";
import { formatCount } from "@/lib/utils";

export const runtime    = "nodejs";
export const revalidate = 3600;
export const alt        = "Havlo · Find similar products for less";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default async function HomeOG({ params }: { params: { country: string } }) {
  const count = await getShoppableStoreCount(params.country).catch(() => 0);
  return new ImageResponse(
    (
      <OgShell
        headline="Find similar products"
        subline="for less."
        subhead="Paste a link or search anything. Havlo finds cheaper alternatives across the stores you already know."
        statusDot={count > 0 ? { color: "#22C55E", text: `Live · ${formatCount(count)} stores` } : null}
      />
    ),
    size,
  );
}
