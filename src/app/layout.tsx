import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Slackey } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ui/ThemeProvider";
import { CountryProvider } from "@/components/providers/CountryProvider";
import { getServerCountry } from "@/lib/country-server";
import JsonLd from "@/components/seo/JsonLd";
import GoogleAnalytics from "@/components/seo/GoogleAnalytics";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/* Header / display font — Bricolage Grotesque has sharp letterforms,
   tight spacing, and a magazine-cover feel that pairs cleanly with
   Inter's neutral body text. */
const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
  description:
    "Paste any product link or search anything. Havlo finds cheaper alternatives across the world's biggest stores in Nigeria, US, UAE, Germany, India, and South Africa.",
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
    description: "Paste a link, get cheaper alternatives in seconds.",
    url: siteUrl,
    siteName: "Havlo",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: "Havlo · Find similar products for less",
    description: "Paste a link, get cheaper alternatives in seconds.",
    site: "@havlo_io",  // placeholder — update when you claim the X handle
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
  /* Read country from cookie on the server so the first paint already
     shows the user's flag/currency — no FOUC swap on hydration. */
  const initialCountry = getServerCountry();

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
          <CountryProvider initialCode={initialCountry.code}>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </CountryProvider>
        </ThemeProvider>
        {/* GA4 — no-op until NEXT_PUBLIC_GA_ID is set in env */}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
