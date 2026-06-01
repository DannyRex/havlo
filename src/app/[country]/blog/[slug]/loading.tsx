import BlogSkeleton from "@/components/blog/BlogSkeleton";

/* Blog post loading state. Overrides the parent blog/loading.tsx (an
   index card list) with the article shape — back link + header + prose
   lines + footer — mirroring blog/[slug]/page.tsx's max-w-2xl column.
   Without it, a post would flash the index-list skeleton (or, before
   that file existed, the homepage shell). */
export default function Loading() {
  return <BlogSkeleton variant="post" />;
}
