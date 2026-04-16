"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/compare", label: "Compare prices" },
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
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 select-none shrink-0">
          <LogoMark />
          <span className="text-[17px] font-bold tracking-[-0.03em] text-white">
            Deal<span style={{ color: "#00C8FF" }}>esty</span>
          </span>
        </Link>

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
          <div className="w-px h-4 bg-white/[0.1] mx-2" />
          <Link
            href="/deals"
            className="btn-primary text-sm py-2 px-5 rounded-xl"
          >
            Browse Deals
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden glass border-t border-white/[0.06] px-4 py-4 flex flex-col gap-2">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "px-4 py-3 rounded-xl text-sm font-medium transition-all",
                pathname === href
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/[0.06]">
            <Link
              href="/deals"
              onClick={() => setMenuOpen(false)}
              className="btn-primary w-full justify-center text-sm py-3"
            >
              Browse Deals
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
