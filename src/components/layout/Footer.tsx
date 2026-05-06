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
      { label: "Blog",    href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy",       href: "/privacy-policy" },
      { label: "Terms of Use",         href: "/terms-of-use" },
      { label: "Disclaimer",           href: "/disclaimer" },
      /* Anchor link jumps to the disclosure section on the existing
         Disclaimer page. FTC clear-and-conspicuous standard is met
         by a footer link to a clearly-labelled disclosure page —
         we don't need a heavy block on every page. Matches the
         pattern Dupe / Spoken / NerdWallet / Wirecutter all use. */
      { label: "Affiliate disclosure", href: "/disclaimer#affiliate-disclosure" },
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
              Find similar products for less. Paste a link or search anything, we find cheaper alternatives across the stores you already know.
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

        {/* Compliance note: the prominent disclosure block that used
            to live here was replaced with the 'Affiliate disclosure'
            link in the Legal column above. FTC clear-and-conspicuous
            standard is met by a footer link to a clearly-labelled
            disclosure page; Amazon Associates Operating Agreement is
            satisfied by the 'as an Amazon Associate' phrase living on
            /disclaimer. Matches the lighter-touch pattern used by
            Dupe, Spoken, NerdWallet, Wirecutter, and Skyscanner. */}

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
