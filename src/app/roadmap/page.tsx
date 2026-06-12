import type { Metadata } from "next";
import RoadmapBoard from "@/components/roadmap/RoadmapBoard";

/* Public product roadmap — /roadmap (country-agnostic root route, like
   the legal pages; middleware leaves it bare). Items come from the
   static list in src/lib/data/roadmap.ts; votes load client-side from
   /api/roadmap so this page stays a static shell. PostHog-style
   transparency, one-tap voting, no accounts. */

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What we're building next on Havlo, and what's already shipped. Vote for the features you want first.",
  alternates: { canonical: "https://havlo.io/roadmap" },
};

export default function RoadmapPage() {
  return (
    <main className="bg-bg">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="mb-10 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-[1.08] mb-3">
            What we&apos;re building
          </h1>
          <p className="text-ink-2 text-[15px] sm:text-base leading-relaxed">
            The features on our list, in the open. Tap the arrow on anything
            you want sooner. Votes genuinely set the order we build in.
          </p>
        </header>
        <RoadmapBoard />
        <p className="mt-12 text-[13px] text-ink-3 leading-relaxed">
          Have an idea that isn&apos;t here? Tell us at{" "}
          <a href="mailto:hello@havlo.io" className="underline underline-offset-2 hover:text-ink">
            hello@havlo.io
          </a>
          .
        </p>
      </section>
    </main>
  );
}
