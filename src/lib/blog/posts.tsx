/* Blog post registry — one place to add new posts.

   Why a flat registry instead of MDX or filesystem-scanning: keeps
   the scaffold simple and dep-free. Each post is a TSX object with
   metadata + JSX body; add a new entry here and it shows up in the
   /blog index, gets a slug page, and is included in the sitemap
   automatically.

   When the post volume grows (~20+ posts) and authoring becomes
   the bottleneck, migrate to @next/mdx or to a CMS (Contentlayer,
   Notion API, Sanity). For now this is the cheapest workable
   path that lets us start the SEO content engine immediately.

   Authoring guide for new posts:
     1. Add an entry below with slug, title, description,
        publishedAt (ISO date), and body (JSX)
     2. Use semantic HTML: <h2> for sections, <p> for paragraphs,
        <ul>/<li> for lists, <strong> for emphasis
     3. Affiliate links inside posts go through /api/go like any
        other outbound link so they pick up the right tag
     4. Open Graph metadata is auto-generated from title +
        description in /blog/[slug]/page.tsx — no extra work
*/

import type { ReactNode } from "react";

export interface BlogPost {
  slug:        string;
  title:       string;
  description: string;
  /** ISO date — drives sort order on /blog index + sitemap lastmod. */
  publishedAt: string;
  /** Reading time estimate, shown next to date. Manually set for
      now; could compute from word count later. */
  readMinutes: number;
  /** Optional categorization for future /blog?category=X views. */
  tags?:       string[];
  body:        ReactNode;
}

export const posts: BlogPost[] = [
  {
    slug:        "best-iphone-15-pro-max-deals-nigeria-2026",
    title:       "Best iPhone 15 Pro Max Deals in Nigeria 2026",
    description: "Where to actually find the cheapest iPhone 15 Pro Max in Nigeria right now — with current prices across Jumia, Konga, Slot, and 3C Hub, and which cross-border options beat them.",
    publishedAt: "2026-05-05",
    readMinutes: 4,
    tags:        ["phones", "nigeria", "buying-guide"],
    body: (
      <>
        <p>
          The iPhone 15 Pro Max is still the most-searched phone on Havlo a
          full eighteen months after launch. With local pricing across
          Nigerian retailers ranging from{" "}
          <strong>₦1.45M to ₦2.1M</strong> for the same configuration,
          knowing where to look saves real money.
        </p>
        <p>
          We pulled the current listings from every major Nigerian retailer
          covering iPhones plus the cross-border options Nigerians actually
          use. Here&apos;s where the actual best prices live this week.
        </p>

        <h2>Local Nigerian retailers</h2>
        <p>
          Local retailers ship faster and handle warranty service in country.
          For most buyers, this is the cheaper total cost once import duties
          and shipping risk are factored in.
        </p>
        <ul>
          <li>
            <strong>Slot</strong> consistently has the sharpest pricing on
            current-gen iPhones in Nigeria. Their authorized-reseller status
            with Apple gives them better margin to play with than smaller
            shops, and they pass savings down on flagship models.
          </li>
          <li>
            <strong>3C Hub</strong> typically matches Slot within ₦20-50k and
            occasionally beats them on flash sales. Worth checking both before
            committing.
          </li>
          <li>
            <strong>Jumia and Konga</strong> have the widest selection
            including refurbished + foreign-used variants at lower price
            points. Read the listing carefully for grade descriptions.
          </li>
          <li>
            <strong>Kara</strong> often runs aggressive promotions on
            specific configurations (256GB Natural Titanium especially).
          </li>
        </ul>

        <h2>Cross-border options worth considering</h2>
        <p>
          For buyers comfortable with 2-4 week shipping windows and willing to
          handle import duties, cross-border can save ₦150-300k on a single
          phone. Two options dominate.
        </p>
        <ul>
          <li>
            <strong>Amazon US</strong> with a forwarding service gets you
            to the lowest delivered price for sealed retail units. Add 15%
            for typical Lagos customs duty + ~$30 forwarding fee.
          </li>
          <li>
            <strong>AliExpress global plaza sellers</strong> offer
            competitive pricing on grey-market sealed units, but warranty
            service is on the seller, not Apple Nigeria.
          </li>
        </ul>

        <h2>The honest tradeoff</h2>
        <p>
          Local at Slot or 3C Hub: roughly ₦150-200k more, but Apple-Nigeria
          warranty + immediate hands-on inspection. Cross-border: cheapest
          delivered price, but you wait weeks and warranty is on you.
        </p>
        <p>
          For a flagship phone you&apos;ll keep for 3+ years, the ₦150k
          warranty premium is usually worth it. For a second device or a
          gift, cross-border is fine.
        </p>

        <h2>How we update this</h2>
        <p>
          Havlo refreshes prices across all the retailers above every
          24 hours. The article reflects current pricing logic and where the
          deals consistently sit; for live current numbers, search any
          iPhone 15 model on the home page and you&apos;ll see real-time
          comparisons.
        </p>
      </>
    ),
  },
];

/** Lookup helper for the dynamic [slug] route. */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

/** Slug list for generateStaticParams. */
export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug);
}

/** Sort by date desc — used by /blog index. */
export function getPostsByDate(): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}
