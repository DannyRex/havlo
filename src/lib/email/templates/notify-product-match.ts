/* Match-found email — sent when the notify-product cron finds
   catalog matches for a query in product_requests.

   Visual treatment: personal shell with a tight list of match rows
   (price + title + store on a single bordered row each). Leaner
   than the digest's dealCard because this is still a transactional
   notification ("here's what surfaced for you") — Gmail Primary tab
   placement matters more than card-grid polish.

   Triggered by: scripts/cron/match-product-requests.ts (Phase 2,
   not yet shipped). Cron should:
     1. Read product_requests where notified_at IS NULL
     2. Run search_products_fts() against the catalog for each query
     3. If matches at >= some discount threshold, send this email
        with the top 5 offers
     4. UPDATE product_requests SET notified_at = now() to dedupe */

import {
  shellPersonal,
  paragraph,
  signature,
  spacer,
  matchRow,
  textLink,
  escapeHtml,
  plainTextShell,
  type MatchRowData,
} from "./_layout";
import { displayStoreName } from "@/lib/store-display";

interface Args {
  query:   string;
  /** ISO-2 country code from the request row. Defaults to 'ng'. */
  country: string | null;
  /** Cheapest 1-5 offers, ordered by price ascending. */
  offers:  MatchRowData[];
}

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

const SITE_URL = "https://havlo.io";

export function notifyProductMatchFound({ query, country, offers }: Args): Email {
  const cc = (country ?? "ng").toLowerCase();
  const compareUrl = `${SITE_URL}/${cc}/compare?q=${encodeURIComponent(query)}`;

  /* Singular "we found" reads as a personal update; "we found 5
     matches" reads as a system notification. Keep the human framing
     in the subject even when offers.length > 1. */
  const subject   = `We found "${query}"`;
  const preheader = `${offers.length} ${offers.length === 1 ? "offer" : "offers"} surfaced on Havlo, cheapest first.`;

  /* ── HTML body ──────────────────────────────────────────────── */

  /* Clean the merchant string once so both the HTML match rows
     (_layout's matchRow) and the plain-text fallback show "eBay"
     instead of an "eBay - <seller-handle>" marketplace string.
     _layout escapes but doesn't normalise, and it's a shared shell
     we don't edit, so the cleaning happens here at the data edge. */
  const top = offers.slice(0, 5).map((o) => ({
    ...o,
    storeName: displayStoreName(o.storeName),
  }));
  const rowsHtml = top.map((o, i) => matchRow(o, i === top.length - 1)).join("\n");

  const body = `
${paragraph("Hi,")}
${paragraph(`Quick update on <strong style="font-weight:600;">${escapeHtml(query)}</strong>. Here's what surfaced on Havlo at meaningful discounts, cheapest first:`)}
${rowsHtml}
${spacer(20)}
${paragraph(`${textLink({ url: compareUrl, label: "See all matches on Havlo" })}.`)}
${signature("Danny")}
${spacer(8)}
`;

  const html = shellPersonal({ preheader, body, transactional: true });

  /* ── Plain text body ────────────────────────────────────────── */

  const offerLines = top.map((o) =>
    `${o.priceDisplay}  ${o.title} (${o.storeName})\n${o.url}`,
  ).join("\n\n");

  const text = plainTextShell({
    transactional: true,
    body: [
      `Quick update on "${query}". Here's what's surfaced on Havlo at meaningful discounts, cheapest first:`,
      ``,
      offerLines,
      ``,
      `See all matches: ${compareUrl}`,
    ],
  });

  return { subject, text, html };
}

/* Re-export MatchRowData so the cron caller can type its payload
   without depending on the layout module directly. */
export type { MatchRowData };
