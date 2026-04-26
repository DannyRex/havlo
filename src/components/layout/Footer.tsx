import Link from "next/link";
import Logo from "@/components/ui/Logo";

/* Only links to pages that actually exist. Contact + Press kit removed
   per request. About removed (no page yet — easy to add back later). */
const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Browse deals",  href: "/deals" },
      { label: "Find for less", href: "/compare" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Use",   href: "/terms-of-use" },
      { label: "Disclaimer",     href: "/disclaimer" },
    ],
  },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4" aria-label="Havlo home">
              <Logo size={28} />
            </Link>
            <p className="text-sm text-ink-2 leading-relaxed max-w-xs mb-4">
              Find similar products for less. Paste any link or search anything, we surface the cheaper alternatives.
            </p>
            <Link
              href="/contact"
              className="text-sm text-ink-2 hover:text-ink transition-colors underline-offset-4 hover:underline"
            >
              Contact us →
            </Link>
          </div>

          {/* Link columns */}
          {footerSections.map(({ title, links }) => (
            <div key={title}>
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-[0.08em] mb-4">{title}</p>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-ink-2 hover:text-ink transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-ink-3">
            © {year} Havlo. Independent product discovery.
          </p>
          <p className="text-xs text-ink-3">
            Final prices, stock and shipping are set by each retailer.
          </p>
        </div>
      </div>
    </footer>
  );
}
