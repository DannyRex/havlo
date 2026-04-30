import Link from "next/link";
import { Instagram } from "lucide-react";
import Logo from "@/components/ui/Logo";
import CountrySelect from "@/components/layout/CountrySelect";

/* Footer dedupe: Contact lives in the brand block (link below the
   tagline), not in a separate "Company" column with one item. About /
   Help land in the Company column when those pages exist. */
const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Browse deals",  href: "/deals" },
      { label: "Find for less", href: "/compare" },
      { label: "Contact",       href: "/contact" },
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

        <div className="grid gap-10 sm:grid-cols-3 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4" aria-label="Havlo home">
              <Logo size={28} />
            </Link>
            <p className="text-sm text-ink-2 leading-relaxed max-w-xs">
              Find similar products for less. Paste any link or search anything, we surface the cheaper alternatives.
            </p>
            <a
              href="https://instagram.com/havlo.io"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Havlo on Instagram (@havlo.io)"
              className="mt-4 inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink transition-colors"
            >
              <Instagram size={16} aria-hidden="true" />
              <span>@havlo.io</span>
            </a>
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
          <div className="flex items-center gap-4">
            <p className="text-xs text-ink-3 hidden md:block">
              Final prices, stock and shipping are set by each retailer.
            </p>
            {/* TEMP: Sovrn Commerce site-verification link. Click once
                to satisfy their onboarding step 4 (Get a click).
                REMOVE this after Sovrn confirms verification. */}
            <a
              href="https://sovrn.co/i1u0afm"
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="text-[11px] text-ink-3 hover:text-ink transition-colors underline-offset-4 hover:underline"
            >
              Featured deal
            </a>
            <CountrySelect dropUp />
          </div>
        </div>
      </div>
    </footer>
  );
}
