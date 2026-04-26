import type { Metadata } from "next";
import DealFeed from "@/components/deals/DealFeed";

export const metadata: Metadata = {
  // Title template in app/layout.tsx already appends "· Havlo" — don't double up
  title: "Deals worth checking today",
  description:
    "Browse fresh price drops and standout offers from stores Nigerians already shop. Filter fast and find the deals worth opening.",
  openGraph: {
    title: "Deals worth checking today · Havlo",
    description:
      "Browse fresh price drops and standout offers from stores Nigerians already shop.",
  },
};

export default function DealsPage() {
  return <DealFeed />;
}
