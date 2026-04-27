/* Next.js 14 Apple touch icon — served at /apple-icon.
   180x180 PNG, used when users add Havlo to their iOS home screen.
   Refreshed to the new brand: dark slate backplate, white Slackey
   "h" centered. */

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

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

export default async function AppleIcon() {
  const slackey = await loadSlackey();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0F172A", // slate-900 — premium dark backplate
          /* iOS auto-rounds the corners, but a hint helps the splash. */
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontSize: 140,
          fontFamily: slackey ? "Slackey" : "system-ui",
          lineHeight: 1,
          paddingTop: 18, // optical centering
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
