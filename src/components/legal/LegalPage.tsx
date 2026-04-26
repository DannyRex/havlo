import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
}

/* Slugify section titles for anchor IDs + ToC links */
function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function LegalPage({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
}: LegalPageProps) {
  return (
    <article className="bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink mb-8 sm:mb-10 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>

        {/* Header */}
        <header className="max-w-3xl mb-10 sm:mb-14">
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-4">
            {eyebrow}
          </p>
          <h1 className="text-[34px] sm:text-5xl font-bold text-ink tracking-[-0.035em] leading-[1.05] mb-5">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-ink-2 leading-relaxed max-w-2xl">
            {description}
          </p>
          <p className="text-[13px] text-ink-3 mt-6">
            Last updated {lastUpdated}
          </p>
        </header>

        {/* 2-col layout: ToC sidebar on desktop, content on right */}
        <div className="grid lg:grid-cols-[200px_1fr] gap-10 lg:gap-16">

          {/* Table of contents — sticky on desktop, hidden on mobile */}
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-4">
                On this page
              </p>
              <ul className="space-y-2.5 text-sm">
                {sections.map((section) => (
                  <li key={section.title}>
                    <a
                      href={`#${slug(section.title)}`}
                      className="text-ink-2 hover:text-ink transition-colors block leading-snug"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Content */}
          <div className="space-y-12 sm:space-y-14 max-w-2xl">
            {sections.map((section) => (
              <section
                key={section.title}
                id={slug(section.title)}
                className="scroll-mt-24"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.025em] mb-4 leading-tight">
                  {section.title}
                </h2>

                <div className="space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-[15px] sm:text-base text-ink-2 leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.bullets && section.bullets.length > 0 && (
                  <ul className="mt-5 space-y-2.5">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-3 text-[15px] sm:text-base text-ink-2 leading-relaxed"
                      >
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink-3 flex-shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-16 sm:mt-20 pt-8 border-t border-border max-w-2xl">
          <p className="text-sm text-ink-3 leading-relaxed">
            Questions about this policy? Reach us at{" "}
            <a href="mailto:hello@havlo.io" className="text-ink hover:underline underline-offset-2">
              hello@havlo.io
            </a>
            .
          </p>
        </div>

      </div>
    </article>
  );
}
