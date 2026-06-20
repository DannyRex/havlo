/* /compare OG card — leans on the "Find for less" CTA wording.
   Refactored May 2026 v3 to use the shared OgShell component.
   Jun 2026: live per-country store count from the DB (matches the homepage
   Hero + the page it opens). Node runtime + 1h ISR. */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";
import { getShoppableStoreCount } from "@/lib/providers/browse-db";
import { formatCount } from "@/lib/utils";

export const runtime    = "nodejs";
export const revalidate = 3600;
export const alt        = "Find for less · Havlo";
export const size       = OG_SIZE;
export const contentType = "image/png";

export default async function CompareOG({ params }: { params: { country: string } }) {
  const count = await getShoppableStoreCount(params.country).catch(() => 0);
  return new ImageResponse(
    (
      <OgShell
        headline="Before you buy it,"
        subline="find it for less."
        subhead="Paste a link or search anything. Cheaper alternatives across the stores you already know."
        statusDot={count > 0 ? { color: "#22C55E", text: `Live · ${formatCount(count)} stores` } : null}
      />
    ),
    size,
  );
}
