/* ──────────────────────────────────────────────────────────────────
   Brand -> canonical domain, for the brand-index logo tiles.

   The /[country]/brands page renders each brand with <StoreLogo>, which
   resolves a favicon from a domain. There is no bundled /logos asset for
   most brands, so the domain is everything: get it right and Google's
   favicon service returns the brand mark; get it wrong and the tile
   shows a stranger's icon or falls to a letter badge.

   Default: `<slug-without-hyphens>.com`. That is correct for the large
   majority of brands (nike.com, adidas.com, samsung.com, calvinklein.com,
   carolinaherrera.com, ...), because the stored brand slugs are already
   concatenated.

   Overrides: the handful where `<slug>.com` resolves to the WRONG company
   or a dead/parked domain. Each was verified Jun 2026 against Google's s2
   favicon service (returns a real, distinct mark). Sub-brands that have no
   domain of their own (COLLUSION, JDY, Miss Selfridge -> ASOS/Bestseller)
   are deliberately NOT mapped to a parent's domain: a clean letter badge
   is clearer than showing a different brand's logo. */

const BRAND_DOMAIN_OVERRIDES: Record<string, string> = {
  mac:        "maccosmetics.com",        // mac.com is Apple's legacy domain
  nyx:        "nyxcosmetics.com",        // nyx.com does not resolve
  hollister:  "hollisterco.com",         // hollister.com is unrelated
  honor:      "hihonor.com",             // honor.com is unrelated
  beats:      "beatsbydre.com",          // beats.com is not the brand
  bobbibrown: "bobbibrowncosmetics.com", // bobbibrown.com is unrelated
  fentyskin:  "fentybeauty.com",         // shares the Fenty house domain
  creed:      "creedfragrances.com",     // creed.com is unrelated
  afnan:      "afnanperfumes.com",       // afnan.com is parked
  bardot:     "bardot.com.au",           // the fashion label, not bardot.com
  tecno:      "tecno-mobile.com",        // Transsion brand
  itel:       "itel-mobile.com",         // Transsion brand
  infinix:    "infinixmobile.com",       // Transsion brand (infinix.com is parked)
};

/* Canonical domain for a brand slug (e.g. "mac" -> "maccosmetics.com",
   "nike" -> "nike.com"). Always returns a non-empty host. */
export function resolveBrandDomain(slug: string): string {
  const key = slug.toLowerCase();
  return BRAND_DOMAIN_OVERRIDES[key] ?? key.replace(/[^a-z0-9]/g, "") + ".com";
}
