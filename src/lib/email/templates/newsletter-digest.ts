/* Twice-weekly deals digest — sent by scripts/cron/send-newsletter.ts
   right after the Mon + Thurs scrape cron finishes ingesting fresh
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
  escapeHtml,
  plainTextShell,
  type DealCardData,
} from "./_layout";

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

export function newsletterDigest({ country, category, categoryLabel, deals }: Args): Email {
  const cc = (country ?? "ng").toLowerCase();
  const dealsUrl = `${SITE_URL}/${cc}/deals`;

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

  const dealsHtml = deals.map(dealCard).join("\n");

  const body = `
${heading1(headlineH1)}
${paragraph(escapeHtml(intro))}
${spacer(16)}
${dealsHtml}
${spacer(8)}
${button({ url: dealsUrl, label: `See all today's deals` })}
${signature("Danny")}
${spacer(8)}
`;

  const html = shellMarketing({ preheader, body });

  /* ── Plain text body ────────────────────────────────────────── */

  const dealLines: string[] = [];
  for (const d of deals) {
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
    ],
  });

  return { subject, text, html };
}

/* DealCardData type re-exported so callers (cron/send-newsletter)
   don't have to know about the layout module to type their payload. */
export type { DealCardData };
