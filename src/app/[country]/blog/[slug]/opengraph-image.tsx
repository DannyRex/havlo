/* /[country]/blog/[slug] dynamic OG card.
   Per-post — pulls the blog title + reading time so each share has a
   bespoke preview. Falls back to a generic blog card when the slug
   doesn't resolve (e.g. unpublished post URL got out). */

import { ImageResponse } from "next/og";
import { OgShell, OG_SIZE } from "@/components/seo/og-shell";
import { getPostBySlug } from "@/lib/blog/posts";

/* Edge runtime is fine — getPostBySlug is a pure synchronous lookup
   over the static `posts` array, no DB / fs. The blog body itself
   contains React JSX nodes but we never read `.body` here, only
   `.title`, `.readMinutes`, `.tags`, so the import is cheap. */
export const runtime    = "edge";
export const size       = OG_SIZE;
export const contentType = "image/png";

export const alt = "Havlo blog post";

export default function BlogPostOG({
  params,
}: {
  params: { country: string; slug: string };
}) {
  const post = getPostBySlug(params.slug);

  /* Truncate title at ~80 chars so it doesn't run past the safe area
     in the 1200×630 card. The shell's font-size 80 + maxWidth 1000
     can handle ~3 lines max. */
  const headline = post
    ? truncate(post.title, 80)
    : "Havlo Blog";

  const eyebrow = post
    ? `${post.readMinutes} min read · ${formatDate(post.publishedAt)}`
    : "Blog";

  /* Tags become bottom pills — useful for at-a-glance topic context
     in social previews. Cap at 3 so they fit on one row. */
  const pills = post?.tags?.slice(0, 3);

  return new ImageResponse(
    (
      <OgShell
        eyebrow={eyebrow}
        headline={headline}
        subhead={post?.description ? truncate(post.description, 140) : undefined}
        pills={pills}
      />
    ),
    size,
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function formatDate(iso: string): string {
  // Edge-runtime safe — no Intl.DateTimeFormat options reliance,
  // just a clean Mar 5, 2026 shape from the ISO date.
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
