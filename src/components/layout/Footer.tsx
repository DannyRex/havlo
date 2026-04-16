import Link from "next/link";
import { Zap, Twitter, Instagram, Facebook } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Browse Deals",     href: "/deals" },
    { label: "Compare Prices",   href: "/compare" },
    { label: "Hot Deals",        href: "/deals?filter=hot" },
    { label: "New Arrivals",     href: "/deals?sort=newest" },
  ],
  Categories: [
    { label: "Electronics",  href: "/deals?cat=electronics" },
    { label: "Phones",       href: "/deals?cat=phones" },
    { label: "Gaming",       href: "/deals?cat=gaming" },
    { label: "Fashion",      href: "/deals?cat=fashion" },
  ],
  Stores: [
    { label: "Jumia",       href: "#" },
    { label: "Konga",       href: "#" },
    { label: "Slot",        href: "#" },
    { label: "3C Hub",      href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]" style={{ background: "var(--navy-800)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 100%)" }}>
                <Zap size={16} className="text-white" fill="white" />
              </div>
              <span className="text-lg font-bold">
                <span className="text-white">Deal</span>
                <span style={{ color: "#00C8FF" }}>esty</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed max-w-[200px]">
              Nigeria&apos;s smartest shopping platform. Discover deals, compare prices, find alternatives.
            </p>
            <div className="flex gap-3 mt-4">
              {[Twitter, Instagram, Facebook].map((Icon, i) => (
                <a key={i} href="#"
                   className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}
                          className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
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
          <p className="text-xs text-slate-600">
            © 2024 Dealesty. All rights reserved. Prices subject to change.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600">🇳🇬 Made for Nigeria</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-deal-green animate-pulse" />
              <span className="text-xs text-slate-600">Live prices</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
