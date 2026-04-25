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

export default function LegalPage({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
}: LegalPageProps) {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="max-w-3xl mb-10 sm:mb-12">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.12em] mb-4">
            {eyebrow}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-ink tracking-[-0.04em] leading-[1.02] mb-4">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-ink-2 leading-relaxed tracking-[-0.01em] max-w-2xl">
            {description}
          </p>
          <p className="text-sm text-ink-3 mt-5">Last updated: {lastUpdated}</p>
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <article
              key={section.title}
              className="card rounded-3xl border border-border p-6 sm:p-8"
            >
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.03em] mb-4">
                {section.title}
              </h2>

              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm sm:text-base text-ink-2 leading-relaxed tracking-[-0.01em]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm sm:text-base text-ink-2 leading-relaxed tracking-[-0.01em]">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-success flex-shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}