import Link from "next/link";

const footerSections = [
  {
    title: "Explore",
    links: [
      { label: "Home", href: "/" },
      { label: "Browse Deals", href: "/deals" },
      { label: "Compare Prices", href: "/compare" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Use", href: "/terms-of-use" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
] as const;

const footerNotes = [
  "Independent shopping discovery platform",
  "Prices and stock are controlled by each retailer",
  "We send you straight to the store when you are ready to buy",
] as const;

function FooterLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="footer-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0057FF" />
          <stop offset="100%" stopColor="#00C8FF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#footer-logo-grad)" />
      <path d="M9 8.5h7C20.6 8.5 23.5 12 23.5 16s-2.9 7.5-7.5 7.5H9V8.5z" fill="white" />
      <path d="M12.5 12h3.2c2.8 0 4.3 1.8 4.3 4s-1.5 4-4.3 4h-3.2V12z" fill="url(#footer-logo-grad)" />
    </svg>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06]" style={{ background: "var(--navy-800)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Top row */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 mb-14">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5 select-none">
              <FooterLogo />
              <span className="text-base font-bold tracking-[-0.03em]">
                <span className="text-white">Deal</span>
                <span style={{ color: "#00C8FF" }}>esty</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Dealesty helps you compare prices, spot worthwhile deals, and avoid paying the first price you see.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mt-4 max-w-sm">
              Final prices, stock, delivery fees, and return policies are always set by the retailer.
            </p>
          </div>

          {/* Link columns */}
          {footerSections.map(({ title, links }) => (
            <div key={title}>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-4">{title}</p>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}
                          className="text-sm text-slate-400 hover:text-slate-200 transition-colors tracking-[-0.01em]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-4">What to expect</p>
            <ul className="space-y-3">
              {footerNotes.map((note) => (
                <li key={note} className="flex items-start gap-3 text-sm text-slate-400 leading-relaxed tracking-[-0.01em]">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-deal-green flex-shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-600 tracking-[-0.01em]">
            © {currentYear} Dealesty. Independent price discovery for Nigerian shoppers.
          </p>
          <p className="text-xs text-slate-600 tracking-[-0.01em]">
            Always confirm the final product details and checkout total on the retailer's website.
          </p>
        </div>
      </div>
    </footer>
  );
}
