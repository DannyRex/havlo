import Link from "next/link";
import { Twitter, Instagram, Facebook } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Browse Deals",   href: "/deals" },
    { label: "Compare Prices", href: "/compare" },
    { label: "Hot Deals",      href: "/deals?filter=hot" },
    { label: "New Arrivals",   href: "/deals?sort=newest" },
  ],
  Categories: [
    { label: "Electronics", href: "/deals?cat=electronics" },
    { label: "Phones",      href: "/deals?cat=phones" },
    { label: "Gaming",      href: "/deals?cat=gaming" },
    { label: "Fashion",     href: "/deals?cat=fashion" },
  ],
  Stores: [
    { label: "Jumia",  href: "#" },
    { label: "Konga",  href: "#" },
    { label: "Slot",   href: "#" },
    { label: "3C Hub", href: "#" },
  ],
};

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
  return (
    <footer className="border-t border-white/[0.06]" style={{ background: "var(--navy-800)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5 select-none">
              <FooterLogo />
              <span className="text-base font-bold tracking-[-0.03em]">
                <span className="text-white">Deal</span>
                <span style={{ color: "#00C8FF" }}>esty</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed max-w-[200px]">
              Compare prices across Nigeria&apos;s biggest stores before every purchase.
            </p>
            <div className="flex gap-2 mt-5">
              {[Twitter, Instagram, Facebook].map((Icon, i) => (
                <a key={i} href="#" aria-label="Social link"
                   className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500
                              hover:text-white hover:bg-white/[0.07] transition-all border border-white/[0.06]">
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-4">{title}</p>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}
                          className="text-sm text-slate-500 hover:text-slate-200 transition-colors tracking-[-0.01em]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600 tracking-[-0.01em]">
            © 2025 Dealesty. Prices are subject to change by retailers.
          </p>
          <div className="flex items-center gap-5">
            <span className="text-xs text-slate-600">Made for Nigeria 🇳🇬</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-deal-green animate-pulse" />
              <span className="text-xs text-slate-600">Live prices</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
