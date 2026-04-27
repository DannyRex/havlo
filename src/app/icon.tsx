/* Next.js 14 generated favicon — served at /icon.
   Updated to match the new brand: dark slate backplate, white Slackey
   "h" centered. The blue square + geometric h was retired with the
   logo refresh. Returns a 32x32 PNG at request time, cached at the
   edge by Vercel.

   At 32px, Slackey's swash detail mostly disappears — the favicon
   reads as a confident bold letter on dark slate, which is what we
   want for tiny tab-strip visibility. */

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime = "edge";

/* Load Slackey TTF at request time so Satori can render the wordmark
   letterform. URL is the stable Google Fonts CDN path; if Google
   bumps it we catch + fall back to a system bold via try/catch in
   the handler. */
const SLACKEY_TTF =
  "https://fonts.gstatic.com/s/slackey/v23/40lqgKE2qhgWdpHDCwXHk5_g7Q.ttf";

async function loadSlackey(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(SLACKEY_TTF);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Icon() {
  const slackey = await loadSlackey();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0F172A", // slate-900 — premium dark backplate
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontSize: 26,
          fontFamily: slackey ? "Slackey" : "system-ui",
          lineHeight: 1,
          // Nudge optical centering — Slackey's "h" has a tall ascender
          paddingTop: 4,
        }}
      >
        h
      </div>
    ),
    {
      ...size,
      fonts: slackey
        ? [{ name: "Slackey", data: slackey, style: "normal", weight: 400 }]
        : undefined,
    },
  );
}
