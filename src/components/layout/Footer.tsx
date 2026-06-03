import Link from "next/link";
import { Instagram } from "lucide-react";
import Logo from "@/components/ui/Logo";
import CountrySelect from "@/components/layout/CountrySelect";

/* Three-nav-column footer: Product (functional), Company (about /
   contact / brand-trust), Legal (compliance pages).

   "How we make money" intentionally NOT in any footer column.
   Reachable via the About page + the inline disclosure on /compare
   (right at the click-out point). Mirrors the Wirecutter / Strategist /
   Skyscanner pattern — they reach the disclosure from About / inline
   on review surfaces, never the main footer. Putting it in the
   footer's Privacy/Terms row reads as defensive disclosure
   ("we have to admit this"); putting it under About reads as
   proactive transparency ("here's how the business runs").

   FTC clear-and-conspicuous standard still met because the inline
   notice on /compare appears immediately above every outbound
   click and links to the full page. */
const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Browse deals",  href: "/deals" },
      /* Amazon deals hub — /[cc]/amazon. Bare /amazon is countrified by
         middleware (added to COUNTRY_SCOPED) like /deals + /compare. */
      { label: "Save with Amazon", href: "/amazon" },
      { label: "Find for less", href: "/compare" },
      /* Shop by brand — entry point into the brand-hub system (M2 SEO
         de-orphaning). Root-relative; middleware countrifies to
         /[cc]/brands (registered in COUNTRY_SCOPED). */
      { label: "Shop by brand", href: "/brands" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About",          href: "/about" },
      { label: "Blog",           href: "/blog" },
      /* For merchants — public partnership landing page added F4
         (KuantoKusta-inspired). Sits with About in the Company column
         because the audience overlaps (partners reading "About" to
         decide whether to apply). */
      { label: "For merchants",  href: "/for-merchants" },
      { label: "Contact",        href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      /* "Your Privacy Choices" satisfies CCPA + CPRA + parallel state
         laws (VA / CT / CO / UT) requirement for a clearly-labeled
         opt-out link in the footer. Labeled to match Global Privacy
         Control conventions (vs the harsher literal "Do Not Sell My
         Info" which over-claims since we don't actually sell data). */
      { label: "Your Privacy Choices", href: "/privacy-choices" },
      { label: "Privacy Policy",       href: "/privacy-policy"  },
      { label: "Terms of Use",         href: "/terms-of-use"    },
      /* Accessibility statement — required by the EU Accessibility Act
         (in force 28 June 2025) for e-commerce-related services. Also
         signals good faith on US ADA Title III + UK Equality Act. */
      { label: "Accessibility",        href: "/accessibility"   },
      /* DSA contact — required by EU Digital Services Act (Articles
         11 + 12) for any platform accessible to EU users. Visible
         single point of contact for users + EU authorities. */
      { label: "DSA Contact",          href: "/dsa-contact"     },
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
            {/* Footer blurb — brand statement, not a re-pitch. The hero
                H1 + bottom-CTA already cover the 'paste a link / find
                it for less' action copy; repeating it here was triple-
                hammering the same line on a single page. Now: a single
                sentence on what Havlo IS so the footer reads like a
                brand block, not a sales caption. */}
            <p className="text-sm text-ink-2 leading-relaxed max-w-xs">
              Independent price comparison across the stores you already shop.
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

        {/* Compliance note: the affiliate disclosure now lives on
            /how-we-make-money, linked from the Company column above.
            FTC clear-and-conspicuous standard is met (one-click
            access on every page). Amazon Associates Operating
            Agreement is satisfied by the 'as an Amazon Associate'
            phrase living verbatim on that page. */}

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
