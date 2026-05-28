import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Slackey } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ui/ThemeProvider";
import { CountryProvider } from "@/components/providers/CountryProvider";
import { getRequestCountry } from "@/lib/country-server";
import JsonLd from "@/components/seo/JsonLd";
import GoogleAnalytics from "@/components/seo/GoogleAnalytics";
import Skimlinks from "@/components/seo/Skimlinks";
import CookieConsent from "@/components/seo/CookieConsent";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/* Header / display font — Bricolage Grotesque has sharp letterforms,
   tight spacing, and a magazine-cover feel that pairs cleanly with
   Inter's neutral body text.

   Weight set trimmed (May 2026): was 500/600/700/800. PSI flagged
   font payload as part of the LCP drag at 3.7s. Heading usage
   audit:
     - weight 700 = default heading weight (globals.css h1-h6)
     - weight 600 = font-semibold h2/h3 (used heavily)
     - weight 500 = font-medium, used on 2 h3s — falls back to Inter
     - weight 800 = font-extrabold, UNUSED on any heading
   Dropping 500 + 800 saves ~60-100 kB of font data per page load. */
const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

/* Logo wordmark — Slackey is the Havlo brand mark face. Casual,
   friendly, distinctive. Loaded as a CSS variable so the Logo
   component can reference it without prop-drilling.

   display: "block" (FOIT) instead of swap — eliminates the 100ms
   font-swap layout twitch in the navbar. Slackey is small (~12KB)
   so the brief invisibility is unnoticeable on normal connections. */
const logoFont = Slackey({
  subsets: ["latin"],
  weight: ["400"],   // Slackey ships single weight
  variable: "--font-logo",
  display: "block",
});

const siteUrl = "https://havlo.io";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Havlo · Find similar products for less",
    template: "%s · Havlo",
  },
  /* Meta description — what Google shows in SERP snippets. Aligned
     with the new hero H1 ("Before you buy it, find it for less") so
     the SERP doesn't read one thing while the page reads another.
     Geographic keywords preserved for country-targeted SEO. */
  description:
    "Before you buy it, find it for less. Independent price comparison across the stores you already shop in Nigeria, US, UK, UAE, India, and South Africa.",
  keywords: [
    "price comparison", "find alternatives", "dupes", "find similar products",
    "deals", "discount finder", "shopping search", "cheap alternatives",
    "nigeria deals", "online shopping nigeria", "konga deals", "jumia deals",
  ],
  applicationName: "Havlo",
  authors: [{ name: "Havlo", url: siteUrl }],
  creator: "Havlo",
  publisher: "Havlo",
  /* Self-canonical at the root. Country pages set their own canonicals. */
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "Havlo · Find similar products for less",
    description: "Before you buy it, find it for less. Independent price comparison across the stores you already shop.",
    url: siteUrl,
    siteName: "Havlo",
    locale: "en_NG",
    /* Default OG image for every page that doesn't override images
       in its own openGraph block. Resolves to /opengraph-image at
       the root level (the dark Havlo card). Per-route opengraph-
       image.tsx files (e.g. /[country]/opengraph-image.tsx) take
       precedence on those segments — this is the fallback for legal /
       contact / cashback / blog post pages whose nearest opengraph-
       image was the homepage one and didn't auto-inherit. Closes
       the High 12/13 og:image-missing finding from the QA audit. */
    images: [
      {
        url:    `${siteUrl}/opengraph-image`,
        width:  1200,
        height: 630,
        alt:    "Havlo · Find similar products for less",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Havlo · Find similar products for less",
    description: "Before you buy it, find it for less. Independent price comparison across the stores you already shop.",
    images: [`${siteUrl}/opengraph-image`],
    /* `site` intentionally omitted until the X / Twitter handle is
       claimed. Pointing to a non-existent @handle generates broken
       attribution links in Twitter share cards and hurts share UX. */
  },
  icons: { icon: "/favicon.ico" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview":   "large",
      "max-snippet":         -1,
      "max-video-preview":   -1,
    },
  },
  /* Verification tags — add the codes Google + Bing give you in
     env vars so we don't commit them. */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other:  process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

/* Build-time commit hash. Vercel injects VERCEL_GIT_COMMIT_SHA into the
   build environment; we surface it as a meta tag so QA can confirm
   which commit prod is actually serving without dashboard access. */
const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_COMMIT_SHA ??
  "dev";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* No cookie read here. Reading cookies() in the root layout
     forces every page (including /[country]/...) to render
     dynamically — defeating the revalidate=1800 ISR declared on
     the homepage and pushing TTFB from ~150ms to 3-5s. May 2026
     perf investigation traced 60+ Supabase queries per visit to
     this single line.

     CountryProvider now hydrates from the URL pathname (then cookie,
     then default) on mount — see CountryProvider's useEffect.
     Brief navbar-flag flash on first hydration is the trade-off
     for ISR-able layouts. Acceptable for non-conversion surfaces.
     Country-scoped pages still render with the correct currency in
     their initial HTML because every landing component now accepts
     `country` as a prop derived from params.country (which DOESN'T
     trigger dynamic rendering). */
  return (
    <html lang="en" className={`${inter.variable} ${displayFont.variable} ${logoFont.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <meta name="commit" content={commitSha.slice(0, 7)} />
        {/* Preconnect to image CDNs we frequently load from — saves
            a TCP/TLS handshake on the LCP image. */}
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="dns-prefetch" href="https://www.google.com" />
        <link rel="preconnect" href="https://i.imgur.com" />
        <link rel="dns-prefetch" href="https://images-na.ssl-images-amazon.com" />
        <link rel="dns-prefetch" href="https://m.media-amazon.com" />
        <link rel="dns-prefetch" href="https://ng.jumia.is" />
        <link rel="dns-prefetch" href="https://www-konga-com-res.cloudinary.com" />
        {/* Global structured data — Organization + WebSite + sitelinks
            search box. Per-page pages add their own BreadcrumbList /
            ItemList JSON-LD on top. */}
        <JsonLd data={[organizationJsonLd, websiteJsonLd]} />
      </head>
      <body className="min-h-[100dvh] flex flex-col antialiased font-sans bg-bg text-ink">
        <ThemeProvider>
          {/* Seed CountryProvider with the country middleware resolved
              for this request (the x-havlo-country header): the URL's
              /[country]/ segment when present, else cookie/geo. The
              Navbar lives here in the root layout, above the inner
              [country] CountryProvider, so without a URL-accurate seed
              its SSR render used the cookie's country while the client
              resolved the URL's. That hydration mismatch threw React
              #418/#423/#425 and flashed the wrong flag on first paint. */}
          <CountryProvider initialCode={getRequestCountry().code}>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </CountryProvider>
        </ThemeProvider>
        {/* GA4 — no-op until NEXT_PUBLIC_GA_ID is set in env AND the
            visitor accepts cookies via the consent banner below */}
        <GoogleAnalytics />
        {/* Skimlinks affiliate auto-monetization — no-op until
            NEXT_PUBLIC_SKIMLINKS_ID is set in env AND the visitor
            accepts cookies */}
        <Skimlinks />
        {/* Cookie consent banner — renders only on first visit (or
            after localStorage is cleared). Gates GA4 + Skimlinks. */}
        <CookieConsent />
      </body>
    </html>
  );
}
