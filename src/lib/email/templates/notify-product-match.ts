/* Match-found email — sent when the notify-product cron finds
   catalog matches for a query in product_requests.

   Voice: same founder tone as notify-product confirmation. Short,
   first-person, no em-dashes, no marketing fluff. Lists up to 5
   cheapest current offers with price + store + click-through link
   so the user can act in one tap from the email.

   Triggered by: scripts/cron/match-product-requests.ts (Phase 2,
   not yet shipped). Cron should:
     1. Read product_requests where notified_at IS NULL
     2. Run search_products_fts() against the catalog for each query
     3. If matches at >= some discount threshold, send this email
        with the top 5 offers
     4. UPDATE product_requests SET notified_at = now() to dedupe */

interface Offer {
  /** Product title, truncate-safe (caller may pass full or short). */
  title:     string;
  /** Display name of the store. */
  storeName: string;
  /** Pre-formatted price string with currency symbol. Examples:
      "₦895,000" or "$129.99". Caller handles localization. */
  price:     string;
  /** Outbound URL, already wrapped via /api/go for affiliate
      attribution + click logging. Direct in the email body. */
  url:       string;
}

interface Args {
  query:   string;
  /** ISO-2 country code from the request row. Defaults to 'ng'. */
  country: string | null;
  /** Cheapest 1-5 offers, ordered by price ascending. */
  offers:  Offer[];
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

  /* Subject leans on the trigger event (we found it) without hyping
     the count. Keep it singular even if there are multiple offers —
     'we found "X"' reads as a personal update; 'we found 5 matches
     for "X"' reads as a system notification. */
  const subject = `We found "${query}"`;

  const offerLines = offers.slice(0, 5).map((o) =>
    `${o.price}  ${o.title} (${o.storeName})\n${o.url}`,
  ).join("\n\n");

  const text = [
    `Hi,`,
    ``,
    `Quick update on "${query}". Here's what's surfaced on Havlo at meaningful discounts:`,
    ``,
    offerLines,
    ``,
    `See all matches: ${compareUrl}`,
    ``,
    `Daniel`,
    `Havlo`,
    ``,
    `--`,
    `This is the only email about "${query}". Reply "remove" to drop off the list.`,
  ].join("\n");

  /* HTML version: paragraphs + a list of offer rows. Each row is a
     single line: price (bold), title, store. Anchor wraps the title
     so the user taps once to land on the merchant. No buttons, no
     tables, no brand-color blocks (deliverability). */
  const offerRows = offers.slice(0, 5).map((o) => {
    return `<p style="margin:0 0 14px 0;line-height:1.5;">
<a href="${escapeAttr(o.url)}" style="color:#0057FF;text-decoration:none;font-weight:600;">${escapeHtml(o.title)}</a>
<br/><span style="color:#1f2937;">${escapeHtml(o.price)}</span> <span style="color:#64748b;">— ${escapeHtml(o.storeName)}</span>
</p>`;
  }).join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">
<p>Hi,</p>
<p>Quick update on <strong>${escapeHtml(query)}</strong>. Here's what's surfaced on Havlo at meaningful discounts:</p>
<div style="margin:18px 0 18px 0;padding:14px 16px;background:#f6f7f9;border-radius:10px;">
${offerRows}
</div>
<p>See all matches: <a href="${escapeAttr(compareUrl)}" style="color:#0057FF;">havlo.io/${cc}/compare</a></p>
<p>Daniel<br/><span style="color:#64748b;">Havlo</span></p>
<p style="color:#94a3b8;font-size:13px;margin-top:24px;">This is the only email about "${escapeHtml(query)}". Reply "remove" to drop off the list.</p>
</div>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* For attribute context (href) we additionally need to make sure the
   value can't break out of the quoted attribute. The same five-char
   set is sufficient since outbound URLs are URL-encoded upstream. */
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
