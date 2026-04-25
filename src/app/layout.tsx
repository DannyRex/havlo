import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ui/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = "https://havlo.io";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Havlo — Find similar products for less",
    template: "%s · Havlo",
  },
  description:
    "Paste any product link or search anything — Havlo finds cheaper alternatives across the world's biggest stores.",
  keywords: [
    "price comparison", "find alternatives", "dupes", "find similar products",
    "deals", "discount finder", "shopping search",
  ],
  openGraph: {
    type: "website",
    title: "Havlo — Find similar products for less",
    description: "Paste a link, get cheaper alternatives in seconds.",
    url: siteUrl,
    siteName: "Havlo",
  },
  twitter: {
    card: "summary_large_image",
    title: "Havlo — Find similar products for less",
    description: "Paste a link, get cheaper alternatives in seconds.",
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased font-sans pb-16 md:pb-0 bg-bg text-ink">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
