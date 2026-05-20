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
    /* Tightened May 2026 v2 after Vercel hit the 5,000-transformation
       free-tier ceiling. Each (deviceSize, imageSize) cell × format
       × image creates a transformation. The old matrix had 7×6×2 = 84
       transformations per unique image, multiplied across thousands of
       products = catastrophic blow-through of the free tier.

       New matrix: 3 device sizes (mobile, tablet, desktop) + 3 image
       sizes (sm thumb, md card, lg hero) = 6×2 = 12 transforms per
       image instead of 84. Still covers every render bucket the UI
       actually uses without over-generating variants. */
    deviceSizes: [640, 1024, 1536],
    imageSizes: [96, 256, 384],
    /* Cache transformations for 60 days minimum. Vercel's edge cache
       respects this — a transformed image stays in cache up to 60d
       even if the underlying source doesn't change. Cuts repeat
       transforms massively. */
    minimumCacheTTL: 60 * 60 * 24 * 60,
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
      /* Canonical host — force www.havlo.io -> havlo.io (308 permanent).
         Both hosts were serving the app, so Google indexed each
         separately with drifting metadata. A permanent host redirect
         consolidates them onto the non-www canonical that every
         <link rel="canonical"> and SITE_URL already uses. */
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.havlo.io" }],
        destination: "https://havlo.io/:path*",
        permanent: true,
      },
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
