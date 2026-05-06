/* /blog/[slug] — legacy slug URL. Redirects to /{country}/blog/[slug]
   where {country} is the post's primary country (first non-"all"
   entry in countries[]) or the user's cookie country for
   cross-cutting "all" posts.

   Why redirect instead of render: keeping a single canonical URL
   per post (the country-prefixed one) prevents duplicate-content
   SEO issues. Existing Google-indexed /blog/{slug} URLs continue
   to work via 307 redirect to the canonical version. */

import { redirect, notFound } from "next/navigation";
import { getPostBySlug, getAllSlugs } from "@/lib/blog/posts";
import { getServerCountry } from "@/lib/country-server";

interface Params {
  slug: string;
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export default function LegacyBlogPostPage({ params }: { params: Params }) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  /* Pick the redirect target country:
       - If the post targets one specific country, use that country
       - If the post targets multiple, prefer the user's cookie country
         when it's in the list, else fall back to the first listed
       - If the post is "all" (cross-cutting), use the user's cookie
         country */
  const userCountry = getServerCountry().code;
  const targets = post.countries ?? [];

  let target: string;
  if (targets.length === 0 || targets.includes("all")) {
    target = userCountry;
  } else if (targets.includes(userCountry)) {
    target = userCountry;
  } else {
    target = targets[0];
  }

  redirect(`/${target}/blog/${post.slug}`);
}
