/* Theme-aware logo inversion for stores whose /logos/<id>.png is a
   single-color transparent wordmark. Shared registry so every
   surface that renders a store logo (StoreLogo cell on /compare,
   DupeCard's "View product" CTA, DupeCard's expanded "+N more"
   list, PriceResults rows) applies the SAME invert rule.

   Without a shared registry the surfaces drift: StoreLogo correctly
   inverts 3C Hub's white-on-transparent wordmark in light mode, but
   DupeCard's raw <Image> showed it as invisible because the registry
   wasn't reachable from there. User report May 2026: "on the cheaper
   alternatives card, 3chub logo is not visible in light mode."

   Add entries when a new store ships a single-color transparent
   logo file. Keep the keys lowercased to match storeId convention. */

/* White-on-transparent wordmarks (designed for dark navbars).
   Inverted in light mode → renders dark; left alone in dark mode. */
export const WHITE_ON_TRANSPARENT_LOGOS = new Set<string>([
  "3chub",
  "threechub",
]);

/* Dark-on-transparent wordmarks (the mirror case). Untouched in
   light mode; inverted in dark mode → renders light. */
export const DARK_ON_TRANSPARENT_LOGOS = new Set<string>([
  "john-lewis-partners",
  "john-lewis",
  "johnlewis",
]);

/** Tailwind class string for the theme-aware invert. Returns an
    empty string for stores whose logo has full-bleed colour (most
    of the catalogue), so callers can append it unconditionally
    without an `if`.

    For surfaces with a THEME-FLIPPING logo cell (bg-bg / bg-surface-2
    that goes light in light mode, dark in dark mode): white logos must
    flip in light mode only, dark logos in dark mode only. */
export function storeLogoInvertClass(storeId: string | undefined | null): string {
  if (!storeId) return "";
  const id = storeId.toLowerCase();
  if (WHITE_ON_TRANSPARENT_LOGOS.has(id)) return "invert dark:invert-0";
  if (DARK_ON_TRANSPARENT_LOGOS.has(id)) return "dark:invert";
  return "";
}

/** Invert rule for logos rendered on a CONSTANT light/white plate
    (the cheaper-alternatives card chips). Because the plate never
    flips with theme, dark + full-colour wordmarks already read on
    white in BOTH modes — only the white-on-transparent marks need
    inverting (to dark) to stay visible. So this is theme-INDEPENDENT:
    a bare `invert` (not the `dark:`-scoped variant above).

    This is what lets a constant-white plate fix EVERY logo at once:
    the dozens of unregistered dark-on-transparent wordmarks (adidas,
    shein, eBay, …) that vanish on a theme-flipping dark cell in dark
    mode simply show as dark-on-white here, no per-store registry
    entry required. Audit May 2026 confirmed 3C Hub is the only
    light-ink transparent wordmark in the bundled set. */
export function storeLogoInvertOnLight(storeId: string | undefined | null): string {
  if (!storeId) return "";
  return WHITE_ON_TRANSPARENT_LOGOS.has(storeId.toLowerCase()) ? "invert" : "";
}
