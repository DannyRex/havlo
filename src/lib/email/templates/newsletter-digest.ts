/* Mon/Wed/Fri deals digest, sent by scripts/cron/send-newsletter.ts
   right after the Mon/Wed/Fri scrape cron finishes ingesting fresh
   inventory.

   Visual treatment: marketing-shell (Havlo wordmark header, large
   H1, deal cards with surface backgrounds, bulletproof CTA button,
   branded footer). The digest IS marketing/content content, so it
   belongs in Gmail's Promotions tab — the rich visual treatment
   serves engagement, not deliverability.

   Voice: founder-led, plain English. No em-dashes. Same shared
   _layout components as every other Havlo email so the inbox
   renders as one suite. */

import {
  shellMarketing,
  heading1,
  paragraph,
  dealCard,
  button,
  signature,
  spacer,
  footnote,
  escapeHtml,
  plainTextShell,
  type DealCardData,
} from "./_layout";
import { displayStoreName } from "@/lib/store-display";

interface Args {
  country: string | null;
  /** Optional category filter — when set, the digest covers a single
      category (phones, audio, …) and the subject/headline call it
      out. Null = cross-category roundup. */
  category?: string | null;
  /** Display name of the category for the subject line (e.g. "Phones",
      "Audio"). Not used when category is null. */
  categoryLabel?: string;
  /** The deals themselves — pre-filtered and ranked by the cron. */
  deals: DealCardData[];
  /** Per-recipient one-click unsubscribe URL (HMAC-signed, from
      src/lib/email/unsubscribe-token.ts). When set, the digest renders
      a footer unsubscribe link in both HTML and plain text. The cron
      builds this fresh for each subscriber, so it must never be cached
      across recipients. */
  unsubscribeUrl?: string;
}

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

const SITE_URL = "https://havlo.io";

/* Founder-voice opener varies slightly by category vs all to keep
   the digest from reading like the same email twice. Same structure
   either way: one sentence framing what's in this digest, then
   the list. */
function opener(category: string | null): string {
  if (category) {
    return `Here's today's strongest drops in this category. We checked the local catalog plus a handful of cross-border partners.`;
  }
  return `Here's today's strongest price drops across the stores you already know. We pulled these from this morning's scrape.`;
}

export function newsletterDigest({ country, category, categoryLabel, deals, unsubscribeUrl }: Args): Email {
  const cc = (country ?? "ng").toLowerCase();
  const dealsUrl = `${SITE_URL}/${cc}/deals`;

  /* Normalise every merchant string once, up front, so both the HTML
     deal cards (rendered by _layout's dealCard) and the plain-text
     fallback below show "eBay" rather than an "eBay - <seller-handle>"
     marketplace string. _layout escapes but does not clean the name,
     and it's a fixed shared shell we don't touch, so the cleaning has
     to happen here at the data boundary. */
  const cleanedDeals: DealCardData[] = deals.map((d) => ({
    ...d,
    storeName: displayStoreName(d.storeName),
  }));

  /* Subjects are STRUCTURALLY DISTINCT so Gmail's subject-similarity
     threading heuristic can't bundle a subscriber's overall digest
     and a category digest into a single conversation. See May 2026
     user report referenced in commit 1550e58 for context. */
  const subject = category && categoryLabel
    ? `In ${categoryLabel} today: ${deals.length} new price drops`
    : `${deals.length} fresh deals on Havlo today`;

  /* Preheader — Gmail's inbox-list preview text. Should reinforce
     the subject, not duplicate it. ~80-100 chars is the sweet spot. */
  const preheader = category && categoryLabel
    ? `${deals.length} ${categoryLabel.toLowerCase()} picks ranked by discount, with cross-border alternatives included.`
    : `${deals.length} of today's biggest price drops across the stores you already shop.`;

  const intro       = opener(category ?? null);
  const headlineH1  = category && categoryLabel
    ? `${categoryLabel} drops today`
    : `Today's drops`;

  /* ── HTML body ──────────────────────────────────────────────── */

  const dealsHtml = cleanedDeals.map(dealCard).join("\n");

  /* Footer unsubscribe line. Only rendered when the cron supplies a
     per-recipient signed URL. The visible link lands on the branded
     /unsubscribe-newsletter page; the mailbox-native one-click control
     is driven separately by the List-Unsubscribe headers the cron sets
     on the send. */
  const unsubFootnote = unsubscribeUrl
    ? footnote(
        `You're getting this because you signed up for Havlo deal alerts. ` +
        `<a href="${escapeHtml(unsubscribeUrl)}" style="color:inherit;text-decoration:underline;">Unsubscribe in one click</a>.`,
      )
    : "";

  const body = `
${heading1(headlineH1)}
${paragraph(escapeHtml(intro))}
${spacer(16)}
${dealsHtml}
${spacer(8)}
${button({ url: dealsUrl, label: `See all today's deals` })}
${signature("Danny")}
${spacer(8)}
${unsubFootnote}
`;

  const html = shellMarketing({ preheader, body });

  /* ── Plain text body ────────────────────────────────────────── */

  const dealLines: string[] = [];
  for (const d of cleanedDeals) {
    dealLines.push(
      d.title,
      `  ${d.priceDisplay}${d.originalDisplay ? ` (was ${d.originalDisplay})` : ""}${d.discountPercent > 0 ? ` - ${d.discountPercent}% off` : ""} at ${d.storeName}`,
      `  ${d.url}`,
      ``,
    );
  }

  const text = plainTextShell({
    body: [
      intro,
      ``,
      ...dealLines,
      `See all: ${dealsUrl}`,
      ...(unsubscribeUrl
        ? [``, `Unsubscribe in one click: ${unsubscribeUrl}`]
        : []),
    ],
  });

  return { subject, text, html };
}

/* DealCardData type re-exported so callers (cron/send-newsletter)
   don't have to know about the layout module to type their payload. */
export type { DealCardData };
