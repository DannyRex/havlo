"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tag, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ui/ThemeToggle";

/* ── Wordmark ───────────────────────────────────────────────────── */
function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-[15px] font-bold"
        style={{ background: "#0057FF", letterSpacing: "-0.04em" }}
      >
        h
      </span>
      <span className="text-[18px] font-bold tracking-[-0.03em] text-ink">
        havlo
      </span>
    </span>
  );
}

const navLinks = [
  { href: "/deals",   label: "Deals" },
  { href: "/compare", label: "Find for less" },
];

const tabLinks = [
  { href: "/",        label: "Home",          Icon: Home   },
  { href: "/deals",   label: "Deals",         Icon: Tag    },
  { href: "/compare", label: "Find for less", Icon: Search },
];

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* ── Top header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur-xl border-b border-border">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Havlo home"
            className="-ml-1 px-1 py-1 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <Wordmark />
          </Link>

          {/* Right cluster — links + theme toggle */}
          <div className="flex items-center gap-1">
            <div className="hidden md:flex items-center gap-1 mr-2">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-medium transition-colors",
                    isActive(href)
                      ? "text-ink bg-surface-2"
                      : "text-ink-2 hover:text-ink hover:bg-surface-2",
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* ── Mobile bottom tab — 3 tabs, no duplicates ─────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-bg/95 backdrop-blur-xl border-t border-border"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-3 h-16">
          {tabLinks.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors min-w-0",
                  active ? "text-ink" : "text-ink-3",
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.75}
                  className={active ? "text-brand" : ""}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="h-safe-bottom" />
      </nav>
    </>
  );
}
