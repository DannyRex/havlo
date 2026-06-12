import type { Metadata } from "next";
import RoadmapBoard from "@/components/roadmap/RoadmapBoard";
import { roadmapItemsForCountry } from "@/lib/data/roadmap";
import { getCountry, ACTIVE_COUNTRIES } from "@/lib/country";
import { SITE_URL, buildHreflangAlternates } from "@/lib/seo";

/* Public product roadmap — /[country]/roadmap (countrified June 2026;
   previously a bare root route, which pinned the navbar to the default
   country and showed ₦ examples to UK/US visitors). Items come from the
   static list in src/lib/data/roadmap.ts, filtered + localized per
   market via roadmapItemsForCountry; votes load client-side from
   /api/roadmap and aggregate globally across countries. */

export const revalidate = 86400;

export function generateStaticParams() {
  return ACTIVE_COUNTRIES.map((c) => ({ country: c.code }));
}

export async function generateMetadata({
  params,
}: {
  params: { country: string };
}): Promise<Metadata> {
  const country = getCountry(params.country);
  return {
    title: "Roadmap",
    description:
      "What we're building next on Havlo, and what's already shipped. Vote for the features you want first.",
    alternates: {
      canonical: `${SITE_URL}/${country.code}/roadmap`,
      languages: buildHreflangAlternates("roadmap"),
    },
  };
}

export default function RoadmapPage({ params }: { params: { country: string } }) {
  const country = getCountry(params.country);
  const items = roadmapItemsForCountry(country.code);

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
        <RoadmapBoard items={items} />
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
