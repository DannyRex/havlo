/* Cross-platform country flag rendering.

   Why this exists: regional indicator emoji (🇬🇧, 🇺🇸, 🇳🇬, …) don't
   render as flags on Windows. Microsoft's Segoe UI Emoji ships the
   regional indicator glyphs but not the flag composite — Windows
   Chrome / Edge users see the bare two-letter country code in a
   small box where every other OS shows a flag. User report May
   2026 with screenshots from Windows Chrome.

   Fix: render flags as SVG images from flagcdn.com (Cloudflare-
   backed, free, no auth, 31-day edge cache). Every platform sees
   the same flag — including Windows, Linux, headless screenshots,
   and OG-image renderers. The CSS .flag-emoji class that tried to
   force Segoe UI Emoji stays in place for the OG-image / share
   surfaces (it's still a reasonable fallback there), but every
   interactive surface now uses this component.

   No next/image: the SVGs are tiny (~1-3KB each, already cached at
   the CDN edge), Next.js image optimization adds no value AND
   would force us to allowlist flagcdn.com in next.config's
   images.remotePatterns. Plain <img> is simpler. */

interface Props {
  /** Our internal country code (matches src/lib/country.ts). */
  code:      string;
  /** Square-equivalent pixel size. Aspect ratio is 4:3 so actual
      rendered dimensions are size × (size × 0.75). Default 20. */
  size?:     number;
  className?: string;
  /** Set when the flag carries meaning the surrounding text doesn't
      already convey. Leave empty when adjacent to the country name
      or code label — screen readers skip aria-hidden flags then. */
  alt?:      string;
}

/* Internal code → flagcdn ISO code. The only mismatch in our set
   is "uk" → "gb" (flagcdn uses ISO 3166-1 alpha-2, where Great
   Britain is "gb" not "uk"). All other countries match. */
function flagcdnCode(code: string): string {
  return code.toLowerCase() === "uk" ? "gb" : code.toLowerCase();
}

export default function CountryFlag({ code, size = 20, className, alt = "" }: Props) {
  const cdn = flagcdnCode(code);
  const isDecorative = alt === "";
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://flagcdn.com/${cdn}.svg`}
      alt={alt}
      width={size}
      height={Math.round(size * 0.75)}
      className={`inline-block shrink-0 ${className ?? ""}`}
      aria-hidden={isDecorative ? "true" : undefined}
      /* Loading native — flags are tiny + above-the-fold on most
         surfaces (navbar). Lazy-loading would just add a paint
         flicker for no bandwidth gain. */
      loading="eager"
      decoding="async"
    />
  );
}
