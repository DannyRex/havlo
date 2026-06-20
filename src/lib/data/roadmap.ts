/* Public product roadmap — the single source of truth for /roadmap.

   Items live in code (not the DB) on purpose: the list changes a few
   times a quarter via PR, which keeps copy reviewable and lets the page
   render statically. Only the VOTES live in the database
   (roadmap_votes, migration 0078) — the page degrades gracefully to
   zero counts if that table is missing.

   status:
     "up-next"   — committed, actively being built or next in line
     "exploring" — on the radar; votes here genuinely steer priority
     "shipped"   — live on the site (no vote button)

   ids are permanent once published (votes key on them) — never rename,
   only retire. */

export type RoadmapStatus = "up-next" | "exploring" | "shipped";

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  /** Country codes this item is relevant to. Absent = every market.
      Used by roadmapItemsForCountry so an NG-only feature (solar hub)
      doesn't show on /uk/roadmap and vice versa. */
  markets?: readonly string[];
  /** Country-specific description override — used where the global
      copy embeds a currency or market example (a UK visitor should
      not read "₦400k"). Falls back to `description`. */
  localDescription?: Readonly<Record<string, string>>;
}

export const ROADMAP_ITEMS: RoadmapItem[] = [
  /* ── Up next ─────────────────────────────────────────────── */
  {
    id: "whatsapp-alerts",
    title: "Price alerts on WhatsApp",
    description: "Get your price-drop alerts on WhatsApp instead of email. Set it once, get pinged the moment a price falls.",
    status: "up-next",
  },
  {
    id: "vip-deals-channel",
    title: "VIP flash-deal alerts",
    description: "A members channel for the fastest movers: price errors and flash drops, hand checked and sent within minutes.",
    status: "up-next",
  },
  {
    id: "ask-havlo",
    title: "Ask Havlo",
    description: "Describe what you need, like 'best washing machine under $450 for a family of 5', and get an answer built from cheapest prices across stores.",
    status: "up-next",
    /* Market-priced examples so the teaser reads native everywhere. */
    localDescription: {
      ng: "Describe what you need, like 'best washing machine under ₦400k for a family of 5', and get an answer built from cheapest prices across stores.",
      uk: "Describe what you need, like 'best washing machine under £350 for a family of 5', and get an answer built from cheapest prices across stores.",
      in: "Describe what you need, like 'best washing machine under ₹30,000 for a family of 5', and get an answer built from cheapest prices across stores.",
      ae: "Describe what you need, like 'best washing machine under AED 1,500 for a family of 5', and get an answer built from cheapest prices across stores.",
      za: "Describe what you need, like 'best washing machine under R8,000 for a family of 5', and get an answer built from cheapest prices across stores.",
    },
  },
  {
    id: "cashback",
    title: "Cashback",
    description: "Earn a percentage back on purchases you make through Havlo. Already in the works, waitlist is open.",
    status: "up-next",
  },

  /* ── Exploring ───────────────────────────────────────────── */
  {
    id: "import-calculator",
    title: "Landed-cost import calculator",
    description: "Exact duties and shipping for buying abroad, so you know the true door-delivered price before you order.",
    status: "exploring",
  },
  {
    id: "gift-registries",
    title: "Wishlists and gift registries",
    description: "Build a shareable list for a wedding, a baby, or yourself. Friends buy from whichever store has it cheapest.",
    status: "exploring",
  },
  {
    id: "trade-in-guide",
    title: "What's my phone worth?",
    description: "A live resale and trade-in value guide built from current market prices.",
    status: "exploring",
  },
  {
    id: "browser-extension",
    title: "Browser extension",
    description: "See Havlo's price history and cheaper alternatives right on the store page you're already viewing.",
    status: "exploring",
  },
  {
    id: "group-buying",
    title: "Group buying",
    description: "Team up with other buyers to unlock bulk prices on big-ticket items.",
    status: "exploring",
  },
  {
    id: "solar-hub",
    title: "Solar and inverter comparison",
    description: "Compare inverters, panels, and full solar bundles, with quotes from vetted installers.",
    status: "exploring",
    markets: ["ng"],
  },
  {
    id: "creator-storefronts",
    title: "Creator storefronts",
    description: "Curated deal pages for creators and deal hunters, powered by Havlo's prices.",
    status: "exploring",
  },

  /* ── Shipped ─────────────────────────────────────────────── */
  {
    id: "price-history",
    title: "Price history charts",
    description: "Every tracked product shows where its price has been, so you know if today's deal is real.",
    status: "shipped",
  },
  {
    id: "price-alerts",
    title: "Price-drop alerts",
    description: "Watch a product and get an email the moment its price falls.",
    status: "shipped",
  },
  {
    id: "paste-a-link",
    title: "Paste a link, compare it",
    description: "Drop any product URL into search and Havlo finds it cheaper across stores.",
    status: "shipped",
  },
  {
    id: "ebay-uk",
    title: "eBay UK inventory",
    description: "Real ebay.co.uk listings in the UK catalogue, accessories filtered out.",
    status: "shipped",
    markets: ["uk"],
  },
];

/** Country view of the roadmap: drops items tagged to other markets
    and swaps in market-priced copy where a localDescription exists.
    The vote API stays country-blind (votes aggregate globally). */
export function roadmapItemsForCountry(countryCode: string): RoadmapItem[] {
  const cc = countryCode.toLowerCase();
  /* Strip markets + localDescription from the output (not just resolve
     them): the items are serialized into the RSC payload for the client
     board, and shipping every market's copy would leak other countries'
     currency strings into the page source. */
  return ROADMAP_ITEMS.filter(
    (i) => !i.markets || i.markets.includes(cc),
  ).map(({ markets: _m, localDescription, ...rest }) => ({
    ...rest,
    description: localDescription?.[cc] ?? rest.description,
  }));
}

/** Validated lookup used by the vote API — votes only count for ids
    that exist and aren't shipped. */
export function isVotableRoadmapId(id: string): boolean {
  const item = ROADMAP_ITEMS.find((i) => i.id === id);
  return !!item && item.status !== "shipped";
}
