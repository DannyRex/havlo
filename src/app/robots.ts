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
          /* The `?country=` / `?utm_` Disallow patterns are GONE (June 2026
             GSC audit). Robots-blocking parameter URLs is the WRONG dedupe
             tool: Google can't crawl a blocked URL, so it can't see the
             canonical on it — the URLs pile up forever as "Blocked by
             robots.txt" (357 and rising) and any link equity into them is
             stranded. Every page already declares a clean self-canonical,
             which is the correct consolidation mechanism. Google also
             handles utm_ params natively. */
        ],
      },
      /* Answer engines (ChatGPT, Claude, Perplexity, Gemini-via-GPTBot)
         are now ALLOWED. They cite sources back to the origin, so a Havlo
         price answer surfaced inside an AI assistant drives qualified
         shoppers to the PDP — that's referral traffic, not theft. Listing
         them explicitly with no `disallow` makes the intent auditable;
         they inherit the `userAgent: "*"` rule above (everything except
         /api, /_next, and the dedupe query patterns).

         GPTBot          — OpenAI training + ChatGPT browsing/citations
         OAI-SearchBot   — OpenAI's ChatGPT Search index
         ChatGPT-User    — live fetch when a user asks ChatGPT about a URL
         ClaudeBot       — Anthropic crawler (Claude citations)
         Claude-Web      — Claude live browsing
         anthropic-ai    — legacy Anthropic agent UA
         PerplexityBot   — Perplexity index + citations
         Perplexity-User — Perplexity live fetch on user request
         Google-Extended — gates Gemini/Vertex use of already-crawled pages */
      { userAgent: "GPTBot",          allow: "/" },
      { userAgent: "OAI-SearchBot",   allow: "/" },
      { userAgent: "ChatGPT-User",    allow: "/" },
      { userAgent: "ClaudeBot",       allow: "/" },
      { userAgent: "Claude-Web",      allow: "/" },
      { userAgent: "anthropic-ai",    allow: "/" },
      { userAgent: "PerplexityBot",   allow: "/" },
      { userAgent: "Perplexity-User", allow: "/" },
      { userAgent: "Google-Extended",  allow: "/" },
      /* Still blocked: bulk scrapers that grab pricing to resell as their
         own dataset and send zero referral traffic back. CCBot feeds
         Common Crawl (indiscriminate training corpus, no citation);
         Bytespider (ByteDance) has a track record of ignoring robots and
         hammering origins. No upside to either. */
      { userAgent: "CCBot",           disallow: "/" },
      { userAgent: "Bytespider",      disallow: "/" },
    ],
    sitemap: "https://havlo.io/sitemap.xml",
    host:    "https://havlo.io",
  };
}
