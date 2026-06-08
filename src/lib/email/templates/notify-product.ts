/* Confirmation email sent right after a user submits the
   'Tell me when you find it' form on /deals or /compare empty state.

   Visual treatment: personal shell. Reads like a personal note from
   the founder so Gmail keeps it in Primary, not Promotions. The
   match-found notification is a separate flow (notify-product-match)
   triggered by the matching cron when offers actually surface. */

import {
  shellPersonal,
  paragraph,
  signature,
  spacer,
  textLink,
  escapeHtml,
  plainTextShell,
} from "./_layout";

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

  const subject   = `We're watching for "${query}"`;
  const preheader = `When something matching shows up at a real discount, I'll email you the offers cheapest-first.`;

  /* ── HTML body ──────────────────────────────────────────────── */

  const body = `
${paragraph("Hi,")}
${paragraph(`We're watching for <strong style="font-weight:600;">${escapeHtml(query)}</strong>. When something matching surfaces at a real discount, I'll email you the offers, cheapest first.`)}
${paragraph(`In the meantime, ${textLink({ url: dealsUrl, label: "browse what's already in today" })}.`)}
${signature("Danny")}
${spacer(8)}
`;

  const html = shellPersonal({ preheader, body, transactional: true });

  /* ── Plain text body ────────────────────────────────────────── */

  const text = plainTextShell({
    transactional: true,
    body: [
      `We're watching for "${query}". When something matching surfaces at a real discount, I'll email you the offers, cheapest first.`,
      ``,
      `In the meantime, browse what's already in today: ${dealsUrl}`,
    ],
  });

  return { subject, text, html };
}
