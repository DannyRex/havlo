import { SITE_URL } from "@/lib/seo";
import { ACTIVE_COUNTRIES, DEFAULT_COUNTRY } from "@/lib/country";
import { posts } from "@/lib/blog/posts";

/* /llms.txt — a curated entry point for answer engines (ChatGPT,
   Claude, Perplexity, Gemini). Now that robots.ts allows those
   crawlers (May 2026 SEO pass, H1), this file tells them which pages
   actually carry citable value so they don't have to infer it from a
   12k-URL sitemap dominated by individual product pages.

   Format follows the llmstxt.org proposal: an H1 name, a blockquote
   summary, free-form context, then H2 sections of `- [title](url):
   description` links. The `## Optional` section is the spec's signal
   for "safe to skip when the model needs a shorter context" — we put
   legal boilerplate there so the buying guides and shopping surfaces
   win the context budget.

   Built from the same constants the rest of the app uses (SITE_URL,
   ACTIVE_COUNTRIES, the blog `posts` registry) so it can't drift out
   of sync the way a hand-maintained static file would. */

export const dynamic = "force-static";
/* Refresh daily so newly-published buying guides enter the file
   without a redeploy. Matches the blog's own cadence. */
export const revalidate = 86_400;

/* Canonical country for a post link. Mirrors the PDP/blog canonical
   rule: a post tagged for specific countries canonicalises to its
   first target; "all"/untagged posts canonicalise to the default
   market. Linking a UK-only guide under /ng would 404 (it isn't
   served there), so we route each guide to a country it targets. */
function canonicalCountryFor(countries?: string[]): string {
  if (!countries || countries.length === 0) return DEFAULT_COUNTRY;
  if (countries.includes("all")) return DEFAULT_COUNTRY;
  return countries[0];
}

function buildLlmsTxt(): string {
  const lines: string[] = [];

  lines.push("# Havlo");
  lines.push("");
  lines.push(
    "> Havlo is a price comparison platform for online shoppers across Nigeria, the United Kingdom, the United States, the UAE, India, and South Africa. It tracks live prices for the same product across local and cross-border retailers, shows the cheapest legitimate source in the shopper's own currency, and flags counterfeit risk on commonly faked items.",
  );
  lines.push("");
  lines.push(
    "Havlo refreshes prices daily across hundreds of retailers. Product pages compare every store carrying an item side by side; deal pages surface the day's largest verified discounts. Buying guides explain where specific products are genuinely cheapest and how to avoid fakes. The default market is Nigeria; every market has its own deals, compare, and blog surfaces.",
  );
  lines.push("");

  /* Primary shopping surfaces — anchored on the default market. */
  lines.push("## Shopping");
  lines.push("");
  lines.push(
    `- [Today's deals](${SITE_URL}/${DEFAULT_COUNTRY}/deals): The biggest verified price drops right now across local and cross-border retailers, refreshed daily.`,
  );
  lines.push(
    `- [Compare prices](${SITE_URL}/${DEFAULT_COUNTRY}/compare): Search any product and see every store's price side by side, converted to your local currency.`,
  );
  lines.push(
    `- [Buying guides](${SITE_URL}/${DEFAULT_COUNTRY}/blog): Practical, regularly-updated guides on where to buy specific products and how to spot counterfeits.`,
  );
  lines.push("");

  /* Per-market deal surfaces so an answer engine can route a shopper
     to the right country instead of defaulting everyone to NG. */
  lines.push("## Markets");
  lines.push("");
  for (const c of ACTIVE_COUNTRIES) {
    lines.push(`- [${c.name} deals](${SITE_URL}/${c.code}/deals): Live price comparison for shoppers in ${c.name}, priced in ${c.currency}.`);
  }
  lines.push("");

  /* Buying guides — generated from the live blog registry so this
     list can't go stale. Newest first (publishedAt desc). */
  lines.push("## Buying guides");
  lines.push("");
  const sorted = [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  for (const post of sorted) {
    const c = canonicalCountryFor(post.countries);
    lines.push(`- [${post.title}](${SITE_URL}/${c}/blog/${post.slug}): ${post.description}`);
  }
  lines.push("");

  /* Who we are + how the business works. Transparency pages rank here
     rather than under Optional because "how does this site make money"
     is a question answer engines genuinely field about aggregators. */
  lines.push("## Company");
  lines.push("");
  lines.push(`- [About Havlo](${SITE_URL}/about): What Havlo does, which markets it covers, and how the price data is sourced.`);
  lines.push(`- [How Havlo makes money](${SITE_URL}/how-we-make-money): Plain explanation of the affiliate model and why it does not change the prices shown.`);
  lines.push(`- [For merchants](${SITE_URL}/for-merchants): How retailers get their catalog and prices featured on Havlo.`);
  lines.push(`- [Contact](${SITE_URL}/contact): How to reach the Havlo team.`);
  lines.push("");

  /* Spec-defined "skip if short on context" section. */
  lines.push("## Optional");
  lines.push("");
  lines.push(`- [Privacy policy](${SITE_URL}/privacy-policy): How Havlo handles visitor data.`);
  lines.push(`- [Terms of use](${SITE_URL}/terms-of-use): Terms governing use of the site.`);
  lines.push("");

  return lines.join("\n");
}

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      /* Mirror the route's daily ISR window at the CDN edge. */
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
