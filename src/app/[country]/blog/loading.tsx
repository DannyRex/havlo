import BlogSkeleton from "@/components/blog/BlogSkeleton";

/* Blog index loading state. Without this file the segment inherited
   the country HOMEPAGE shell (hero + trending rail + category grid +
   store-logo marquee), which looks nothing like the narrow max-w-3xl
   post list. The "index" variant mirrors blog/page.tsx. */
export default function Loading() {
  return <BlogSkeleton variant="index" />;
}
