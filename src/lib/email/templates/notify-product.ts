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

  /* Light HTML. Single column, no images, table-based layout for
     legacy email-client compatibility. Brand voice is the same as
     the plaintext — no marketing fluff. */
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <p style="margin:0 0 0 0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0057FF;">Havlo</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">Hey,</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">
                Thanks for telling us you're after <strong>${escapeHtml(query)}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">
                It's now on our find-list. The moment Havlo's catalog has matches at the right price, you'll get one email from this address with the offers ranked cheapest first.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">
                In the meantime, you can browse what we already have.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px 32px;">
              <a href="${dealsUrl}" style="display:inline-block;padding:10px 20px;border-radius:9999px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Browse trending deals →</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">Cheers,</p>
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">Daniel</p>
              <p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">Founder, Havlo</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#94a3b8;">
                This is the only email we'll send about <strong>${escapeHtml(query)}</strong>. If you change your mind, just reply with "remove" and we'll drop you from the list.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

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
