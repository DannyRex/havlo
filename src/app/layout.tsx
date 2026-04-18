import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Dealesty | Compare prices and find better deals in Nigeria",
  description:
    "Check prices across Nigerian stores before you buy. Dealesty helps you compare offers, spot real discounts, and find better-value alternatives in seconds.",
  keywords: ["deals Nigeria", "price comparison Nigeria", "Jumia deals", "Konga deals", "best prices Nigeria"],
  openGraph: {
    title: "Dealesty | Compare prices and find better deals in Nigeria",
    description: "Compare prices, spot real deals, and find better-value alternatives before you buy.",
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
