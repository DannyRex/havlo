import Link from "next/link";
import { Instagram } from "lucide-react";
import Logo from "@/components/ui/Logo";
import CountrySelect from "@/components/layout/CountrySelect";

/* Three-nav-column footer: Product (functional), Company (about /
   contact / brand-trust), Legal (compliance pages). About lives in
   Company because partnership prospects and curious users look there
   first when evaluating "is this a real, trustworthy site." */
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
      { label: "About",   href: "/about" },
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

        {/* Brand + 3 nav columns. Stack on mobile, 2x2 on tablet (brand
            takes full width on its own row at sm), 4 across at lg. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 mb-12">
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
              className="mt-4 inline-flex items-center justify-center text-ink-2 hover:text-ink transition-colors"
            >
              <Instagram size={24} strokeWidth={1.75} aria-hidden="true" />
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

        {/* FTC affiliate disclosure — required by Amazon Associates
            and good practice for any monetized site. Plain language,
            clearly visible, persistent across all pages. */}
        <div className="pt-6 border-t border-border mb-6">
          <p className="text-xs text-ink-3 leading-relaxed max-w-3xl">
            <span className="font-semibold text-ink-2">Affiliate disclosure:</span>{" "}
            Havlo earns commissions on qualifying purchases through some of our links,
            at no extra cost to you. As an Amazon Associate we earn from qualifying
            purchases. This is how we keep Havlo independent and free to use.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-ink-3">
            © {year} Havlo. Independent product discovery.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs text-ink-3 hidden md:block">
              Final prices, stock and shipping are set by each retailer.
            </p>
            <CountrySelect dropUp />
          </div>
        </div>
      </div>
    </footer>
  );
}
