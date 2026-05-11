/* Confirmation email sent right after a user submits the
   'Tell me when you find it' form on /deals or /compare empty state.

   Voice: founder-led, plain English. No em-dashes (brand voice rule).
   Single message per signup. The match-found notification is a
   separate flow (Phase 2: cron + matching logic). */

interface Args {
  query:   string;
  /** ISO-2 country code from the form payload. Defaults to 'ng'. */
  country: string | null;
}

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

const SITE_URL = "https://havlo.io";

export function notifyProductConfirmation({ query, country }: Args): Email {
  const cc = (country ?? "ng").toLowerCase();
  const dealsUrl = `${SITE_URL}/${cc}/deals`;

  const subject = `We're watching for "${query}"`;

  /* Plain-text. Always rendered for clients that block HTML and used
     by inbox preview snippets. Keep it readable as-is. */
  const text = [
    `Hi,`,
    ``,
    `We're watching for "${query}". When something matching surfaces at a real discount, I'll email you the offers, cheapest first.`,
    ``,
    `Browse what's already in today: ${dealsUrl}`,
    ``,
    `Daniel`,
    `Havlo`,
    ``,
    `--`,
    `Reply "remove" anytime to drop off the list.`,
  ].join("\n");

  /* Plain-style HTML — paragraphs only, no tables, no CTA buttons,
     no brand-color headers. Reads as a personal note rather than a
     marketing email, which materially improves Gmail's Inbox-vs-
     Promotions classification for transactional sends. The link is
     a normal underlined anchor with no button styling. */
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">
<p>Hi,</p>
<p>We're watching for <strong>${escapeHtml(query)}</strong>. When something matching surfaces at a real discount, I'll email you the offers, cheapest first.</p>
<p>Browse what's already in today: <a href="${dealsUrl}" style="color:#0057FF;">havlo.io/${cc}/deals</a></p>
<p>Daniel<br/><span style="color:#64748b;">Havlo</span></p>
<p style="color:#94a3b8;font-size:13px;margin-top:24px;">Reply &ldquo;remove&rdquo; anytime to drop off the list.</p>
</div>`;

  return { subject, text, html };
}

/* Minimal HTML escaper for user-supplied query strings. Prevents an
   attacker-supplied query from injecting tags into the email body
   and surviving as live HTML in some clients. Five-char escape is
   sufficient for an HTML body context. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
