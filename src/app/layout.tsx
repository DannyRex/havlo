import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ui/ThemeProvider";

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

const siteUrl = "https://havlo.io";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Havlo · Find similar products for less",
    template: "%s · Havlo",
  },
  description:
    "Paste any product link or search anything. Havlo finds cheaper alternatives across the world's biggest stores.",
  keywords: [
    "price comparison", "find alternatives", "dupes", "find similar products",
    "deals", "discount finder", "shopping search",
  ],
  openGraph: {
    type: "website",
    title: "Havlo · Find similar products for less",
    description: "Paste a link, get cheaper alternatives in seconds.",
    url: siteUrl,
    siteName: "Havlo",
  },
  twitter: {
    card: "summary_large_image",
    title: "Havlo · Find similar products for less",
    description: "Paste a link, get cheaper alternatives in seconds.",
  },
  icons: { icon: "/favicon.ico" },
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
  return (
    <html lang="en" className={`${inter.variable} ${displayFont.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <meta name="commit" content={commitSha.slice(0, 7)} />
      </head>
      <body className="min-h-screen flex flex-col antialiased font-sans bg-bg text-ink">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
