import type { MetadataRoute } from "next";

/* robots.txt — disallow API + Next internals, allow everything else.
   Explicitly named badly-behaved bots that scrape pricing for resale
   without driving traffic. They're free to ignore the directive but
   it's a defensible audit trail. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow: [
          "/api/",
          "/_next/",
          "/*?*country=*",       // dedupe — country lives in URL path, not query
          "/*?*utm_*",           // dedupe — utm-tagged URLs map to canonicals
        ],
      },
      /* Bots that grab pricing data + resell as their own content,
         no traffic value to us. */
      { userAgent: "GPTBot",          disallow: "/" },
      { userAgent: "ChatGPT-User",    disallow: "/" },
      { userAgent: "CCBot",           disallow: "/" },
      { userAgent: "anthropic-ai",    disallow: "/" },
      { userAgent: "PerplexityBot",   disallow: "/" },
      { userAgent: "Claude-Web",      disallow: "/" },
      { userAgent: "ClaudeBot",       disallow: "/" },
      { userAgent: "Bytespider",      disallow: "/" },
    ],
    sitemap: "https://havlo.io/sitemap.xml",
    host:    "https://havlo.io",
  };
}
