import type { Metadata } from "next";
import DealFeed from "@/components/deals/DealFeed";

export const metadata: Metadata = {
  title: "Deals worth checking today | Dealesty",
  description:
    "Browse fresh price drops and standout offers from stores Nigerians already shop. Filter fast and find the deals worth opening.",
};

export default function DealsPage() {
  return <DealFeed />;
}
