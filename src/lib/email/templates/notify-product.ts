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

  const subject = `Got it. We'll let you know when Havlo finds "${query}"`;

  /* Plain-text. Always rendered for clients that block HTML and used
     by inbox preview snippets. Keep it readable as-is. */
  const text = [
    `Hey,`,
    ``,
    `Thanks for telling us you're after "${query}".`,
    ``,
    `It's now on our find-list. The moment Havlo's catalog has matches at the right price, you'll get one email from this address with the offers ranked cheapest first.`,
    ``,
    `In the meantime, you can browse what we already have:`,
    dealsUrl,
    ``,
    `Cheers,`,
    `Daniel`,
    `Founder, Havlo`,
    ``,
    `--`,
    `This is the only email we'll send about "${query}". If you change your mind, just reply with "remove" and we'll drop you from the list.`,
  ].join("\n");

  /* Plain-style HTML — paragraphs only, no tables, no CTA buttons,
     no brand-color headers. Reads as a personal note rather than a
     marketing email, which materially improves Gmail's Inbox-vs-
     Promotions classification for transactional sends. The link is
     a normal underlined anchor with no button styling. */
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">
<p>Hey,</p>
<p>Thanks for telling us you're after <strong>${escapeHtml(query)}</strong>.</p>
<p>It's now on our find-list. The moment Havlo's catalog has matches at the right price, you'll get one email from this address with the offers ranked cheapest first.</p>
<p>In the meantime, you can browse what we already have at <a href="${dealsUrl}" style="color:#0057FF;">havlo.io/${cc}/deals</a>.</p>
<p>Cheers,<br/>Daniel<br/><span style="color:#64748b;">Founder, Havlo</span></p>
<p style="color:#94a3b8;font-size:13px;margin-top:24px;">This is the only email we'll send about "${escapeHtml(query)}". If you change your mind, just reply with "remove" and we'll drop you from the list.</p>
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
