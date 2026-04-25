"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tag, Sparkles, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Logo ───────────────────────────────────────────────────────── */
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

/* ── Desktop nav links ──────────────────────────────────────────── */
const desktopLinks = [
  { href: "/deals",   label: "Browse deals" },
  { href: "/compare", label: "Find for less" },
];

/* ── Mobile bottom tab links ────────────────────────────────────── */
const tabLinks = [
  { href: "/",        label: "Home",         Icon: Home     },
  { href: "/deals",   label: "Deals",        Icon: Tag      },
  { href: "/compare", label: "Find for less", Icon: Sparkles },
  { href: "/compare", label: "Search",       Icon: Search,  searchFocus: true },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop / top nav ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 select-none shrink-0">
            <LogoMark />
            <span className="text-[17px] font-bold tracking-[-0.03em] text-white">
              Deal<span style={{ color: "#00C8FF" }}>esty</span>
            </span>
          </Link>

          {/* Desktop links (hidden on mobile — bottom tab handles it) */}
          <div className="hidden md:flex items-center gap-1">
            {desktopLinks.map(({ href, label }) => (
              <Link
                key={href + label}
                href={href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium tracking-[-0.01em] transition-all duration-150",
                  pathname === href
                    ? "text-white bg-white/[0.06]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]",
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/compare"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg,#0057FF,#00C8FF)" }}
            >
              Find for less
            </Link>
          </div>

        </nav>
      </header>

      {/* ── Mobile bottom tab bar (spoken.io style) ───────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.08]"
        style={{ background: "rgba(5,11,24,0.95)", backdropFilter: "blur(16px)" }}
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-4 h-16">
          {tabLinks.map(({ href, label, Icon, searchFocus }) => {
            const isActive = searchFocus
              ? false // Search tab never shows "active" — it's an action
              : pathname === href || (href !== "/" && pathname.startsWith(href));

            return (
              <Link
                key={label}
                href={searchFocus ? "/compare?focus=1" : href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                  isActive ? "text-white" : "text-slate-500",
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-2xl transition-all",
                  isActive && "bg-white/[0.08]",
                )}>
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className={isActive ? "text-[#00C8FF]" : ""}
                  />
                </div>
                <span className={isActive ? "text-white" : ""}>{label}</span>
              </Link>
            );
          })}
        </div>
        {/* Safe area spacer for phones with home indicator */}
        <div className="h-safe-bottom bg-transparent" />
      </nav>
    </>
  );
}
