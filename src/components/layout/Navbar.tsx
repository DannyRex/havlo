"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Tag, Search, BookOpen, Info, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Logo from "@/components/ui/Logo";
import CountrySelect from "@/components/layout/CountrySelect";

/* Mobile drawer navigation. Includes ALL primary destinations so
   the drawer doubles as a sitemap on phones. Desktop nav only
   surfaces the most-clicked items (filtered below) — Blog + About
   remain reachable via the footer for desktop visitors. */
const navLinks = [
  { href: "/",        label: "Home",          Icon: Home     },
  { href: "/deals",   label: "Deals",         Icon: Tag      },
  { href: "/compare", label: "Find for less", Icon: Search   },
  { href: "/blog",    label: "Blog",          Icon: BookOpen },
  { href: "/about",   label: "About",         Icon: Info     },
];

/* Desktop top nav: Deals + Find for less + Blog. Logo serves as Home;
   About lives in the footer (less frequently clicked on desktop). */
const DESKTOP_LINK_HREFS = new Set(["/deals", "/compare", "/blog"]);
const desktopLinks = navLinks.filter((l) => DESKTOP_LINK_HREFS.has(l.href));

export default function Navbar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  /* Close drawer on route change so navigating from inside it cleans up */
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /* Lock body scroll while drawer is open + close on Escape */
  useEffect(() => {
    if (!drawerOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <>
      {/* ── Top header (desktop + mobile) ──────────────────────────
          - sticky + transform-gpu forces a compositing layer so iOS
            Safari doesn't repaint the bar on every scroll frame
          - backdrop-blur is heavy; only apply on sm+ where the GPU
            cost is worth it. Mobile gets a solid 95% bg instead. */}
      <header
        className="sticky top-0 z-40 border-b border-border bg-bg/95 sm:bg-bg/85 sm:backdrop-blur-xl transform-gpu"
        style={{ WebkitBackdropFilter: undefined }}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Left cluster — hamburger (mobile) + logo */}
          <div className="flex items-center gap-1">
            {/* Mobile hamburger — opens left drawer */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              className="md:hidden -ml-2 p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <Menu size={22} strokeWidth={1.75} />
            </button>

            <Link
              href="/"
              aria-label="Havlo home"
              aria-current={pathname === "/" ? "page" : undefined}
              className="px-1 py-1 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <Logo size={28} />
            </Link>
          </div>

          {/* Right cluster — desktop links + theme toggle */}
          <div className="flex items-center gap-1">
            <div className="hidden md:flex items-center gap-1 mr-2">
              {desktopLinks.map(({ href, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "px-3.5 py-2 rounded-full text-sm font-medium transition-colors",
                      active
                        ? "text-ink bg-surface-2"
                        : "text-ink-2 hover:text-ink hover:bg-surface-2",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <CountrySelect />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* ── Mobile left drawer ───────────────────────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
        className={cn(
          "md:hidden fixed inset-0 z-50 bg-black/45 backdrop-blur-sm transition-opacity duration-200",
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw] bg-bg border-r border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-full flex flex-col p-5">

          {/* Header — logo + close */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              aria-label="Havlo home"
              onClick={() => setDrawerOpen(false)}
            >
              <Logo size={28} />
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="p-2 -mr-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-1">
            {navLinks.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setDrawerOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-colors",
                    active
                      ? "bg-surface-2 text-ink"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.4 : 1.75}
                    className={active ? "text-brand" : ""}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer note inside drawer. Tagline kept generic (no
              hardcoded store counts that drift with each country
              roster change). Contact stays as a low-friction
              secondary link. */}
          <div className="mt-auto pt-6 border-t border-border">
            <p className="text-[11px] text-ink-3 leading-relaxed">
              Find similar products for less. Across local and global stores.
            </p>
            <Link
              href="/contact"
              onClick={() => setDrawerOpen(false)}
              className="text-[11px] text-ink-2 hover:text-ink transition-colors mt-2 inline-block underline-offset-4 hover:underline"
            >
              Contact us
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
