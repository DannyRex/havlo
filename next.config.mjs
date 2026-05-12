const nextConfig = {
  /* React 18 strict mode catches double-effect bugs that would otherwise
     ship to prod silently. Cheap insurance. */
  reactStrictMode: true,

  /* Strip console.* in production except errors/warns — keeps the prod
     bundle leaner without losing the signal you actually want at 3am. */
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },

  /* Aggressive tree-shake for libraries whose ESM index file re-exports
     everything from one barrel. Without this hint, the bundler can't
     statically prove which named exports are dead and ends up shipping
     the whole package per route that imports any subset of it.

     Note: Next 14.2 already auto-applies this transform to a fixed list
     of popular packages, lucide-react included — measured delta from
     adding it explicitly was 0 kB. Kept here as forward-compatible
     documentation: if a future Next minor changes the auto-list, our
     bundle stays optimised because we've stated intent here. Cheap
     insurance, no harm. */
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  images: {
    /* Modern formats — Next negotiates the best one per browser.
       AVIF first (smaller), WebP fallback. Saves ~25–50% over JPEG. */
    formats: ["image/avif", "image/webp"],
    /* Match the most common cell sizes we render so generated thumbnails
       hit the cache cleanly instead of producing one-off variants. */
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536],
    imageSizes: [80, 96, 128, 160, 256, 384],
    remotePatterns: [
      // Allow all HTTPS images (store CDNs vary widely)
      { protocol: "https", hostname: "**" },
      // Also allow HTTP for older store CDNs
      { protocol: "http",  hostname: "**" },
    ],
  },

  /* URL-level redirects.
     /disclaimer → /how-we-make-money: the page was renamed (May 2026)
     to align with peer site naming (Wirecutter / Kayak / Skyscanner all
     use "How we make money" rather than "Disclaimer"). 308 permanent
     redirect preserves any existing search-index ranking + inbound
     links pointing at the old URL. The legacy
     #affiliate-disclosure anchor still resolves because the page's
     first section retains its slug. */
  async redirects() {
    return [
      { source: "/disclaimer",                           destination: "/how-we-make-money", permanent: true },
      { source: "/disclaimer/:path*",                    destination: "/how-we-make-money/:path*", permanent: true },
    ];
  },

  /* Long-cache for fingerprinted static assets. Vercel sets sane defaults
     but pinning here keeps behaviour identical across self-hosted envs. */
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
