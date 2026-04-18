"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/deals", label: "Browse deals" },
  { href: "/compare", label: "Compare prices" },
];

const legalLinks = [
  { href: "/privacy-policy", label: "Privacy policy" },
  { href: "/terms-of-use", label: "Terms of use" },
  { href: "/disclaimer", label: "Disclaimer" },
];

function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nav-logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0057FF" />
          <stop offset="100%" stopColor="#00C8FF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#nav-logo-grad)" />
      <path d="M9 8.5h7C20.6 8.5 23.5 12 23.5 16s-2.9 7.5-7.5 7.5H9V8.5z" fill="white" />
      <path d="M12.5 12h3.2c2.8 0 4.3 1.8 4.3 4s-1.5 4-4.3 4h-3.2V12z" fill="url(#nav-logo-grad)" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="md:hidden p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 select-none shrink-0">
            <LogoMark />
            <span className="text-[17px] font-bold tracking-[-0.03em] text-white">
              Deal<span style={{ color: "#00C8FF" }}>esty</span>
            </span>
          </Link>
        </div>

        {/* Right — nav links + CTA */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium tracking-[-0.01em] transition-all duration-150",
                pathname === href
                  ? "text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="md:hidden w-10" aria-hidden="true" />
      </nav>

    </header>

    <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} />
    </>
  );
}

/* ── Mobile Drawer (portal-style, rendered outside header) ── */
function MobileDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#050B18]/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      />

      {/* Drawer panel */}
      <div
        id="mobile-nav-drawer"
        className="absolute inset-y-0 left-0 w-[min(20rem,84vw)] bg-[#0A1628] border-r border-white/[0.08] flex flex-col shadow-[24px_0_60px_rgba(0,0,0,0.5)] animate-[slideInLeft_0.25s_ease-out]"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06]">
          <Link href="/" onClick={onClose} className="flex items-center gap-2.5 select-none">
            <LogoMark />
            <span className="text-[17px] font-bold tracking-[-0.03em] text-white">
              Deal<span style={{ color: "#00C8FF" }}>esty</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <div className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all whitespace-nowrap",
                pathname === href
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {label}
            </Link>
          ))}

          {/* Legal */}
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col gap-1">
            <span className="px-4 pb-1 text-[11px] font-medium uppercase tracking-widest text-slate-600">Legal</span>
            {legalLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-[13px] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all whitespace-nowrap"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
