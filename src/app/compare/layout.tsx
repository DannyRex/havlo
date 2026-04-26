import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find similar products for less",
  description:
    "Paste a product link or search anything — Havlo finds cheaper alternatives across 12+ Nigerian and global stores.",
  openGraph: {
    title: "Find similar products for less · Havlo",
    description:
      "Paste a product link or search anything — Havlo finds cheaper alternatives across 12+ Nigerian and global stores.",
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
