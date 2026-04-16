"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Zap, LayoutGrid, ArrowLeftRight, Menu, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/deals",   label: "Deals",   icon: LayoutGrid },
  { href: "/compare", label: "Compare", icon: ArrowLeftRight },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #0057FF 0%, #00C8FF 100%)" }}>
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">Deal</span>
            <span style={{ color: "#00C8FF" }}>esty</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                pathname === href
                  ? "bg-brand-600/20 text-brand-400 border border-brand-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/compare" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors">
            <Search size={15} />
            Compare prices
          </Link>
          <Link href="/deals" className="btn-primary text-sm py-2 px-4">
            Browse Deals
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden glass border-t border-white/[0.06] px-4 py-4 flex flex-col gap-2">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                pathname === href
                  ? "bg-brand-600/20 text-brand-400"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/[0.06]">
            <Link href="/deals" onClick={() => setMenuOpen(false)}
                  className="btn-primary w-full justify-center text-sm py-3">
              Browse Deals
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
