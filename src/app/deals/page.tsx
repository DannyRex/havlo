import type { Metadata } from "next";
import DealFeed from "@/components/deals/DealFeed";

export const metadata: Metadata = {
  title: "Browse Deals — Dealesty",
  description:
    "Browse today's best deals from Jumia, Konga, Slot, 3C Hub and 10+ more Nigerian stores. Filter by category and discount level.",
};

export default function DealsPage() {
  return <DealFeed />;
}
