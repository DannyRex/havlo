import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Dealesty — Nigeria's Smartest Shopping Platform",
  description:
    "Discover the best deals, compare prices across 11+ Nigerian stores, and find smarter alternatives. Save big on electronics, fashion, gaming, and more.",
  keywords: ["deals Nigeria", "price comparison Nigeria", "Jumia deals", "Konga deals", "best prices Nigeria"],
  openGraph: {
    title: "Dealesty — Nigeria's Smartest Shopping Platform",
    description: "Discover deals. Compare prices. Find better alternatives.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
