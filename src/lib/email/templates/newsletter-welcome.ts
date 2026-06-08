/* Welcome email sent right after a user subscribes to the deals
   digest via the homepage 'Stay in the loop' strip.

   Visual treatment: personal shell. Smaller wordmark, paragraph
   prose, single text link, signature. No CTA button or surface
   blocks because Gmail tends to bucket those into Promotions.
   Transactional confirmations land best when they read like a
   personal note from the founder.

   Cadence reminder in the body matches the scrape cron: three
   mornings a week (Mon/Wed/Fri). We only email when fresh data lands. */

import {
  shellPersonal,
  paragraph,
  signature,
  spacer,
  textLink,
  footnote,
  escapeHtml,
  plainTextShell,
} from "./_layout";

interface Args {
  country: string | null;
  /** Per-recipient signed one-click unsubscribe URL (from
      unsubscribeLink(email) at the send site). Renders the footer
      unsubscribe link, and the shared shell then drops its "reply remove"
      fallback (bodyHasUnsubscribe). Lets a brand-new subscriber leave from
      email #1 via the same automated path the digest uses, instead of the
      old unautomated "reply remove" promise. */
  unsubscribeUrl?: string;
}

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

const SITE_URL = "https://havlo.io";

export function newsletterWelcome({ country, unsubscribeUrl }: Args): Email {
  const cc = (country ?? "ng").toLowerCase();
  const dealsUrl = `${SITE_URL}/${cc}/deals`;

  const subject   = "You're in. First Havlo digest lands Monday, Wednesday, or Friday.";
  const preheader = "Three emails a week, Monday, Wednesday, and Friday morning. Nothing on idle days.";

  /* ── HTML body ──────────────────────────────────────────────── */

  const body = `
${paragraph("Hi,")}
${paragraph("Thanks for joining the Havlo deals digest.")}
${paragraph(`Three mornings a week (Monday, Wednesday, and Friday), you'll get one email from this address with the strongest deals we found that day. We don't email on the other days. If there's nothing new worth opening, we don't send anything.`)}
${paragraph(`Until the first one ships, ${textLink({ url: dealsUrl, label: `browse what's hot today` })}.`)}
${signature("Danny")}
${spacer(8)}
${unsubscribeUrl ? footnote(`Changed your mind? <a href="${escapeHtml(unsubscribeUrl)}" style="color:inherit;text-decoration:underline;">Unsubscribe in one click</a>.`) : ""}
`;

  const html = shellPersonal({ preheader, body, bodyHasUnsubscribe: Boolean(unsubscribeUrl) });

  /* ── Plain text body ────────────────────────────────────────── */

  const text = plainTextShell({
    bodyHasUnsubscribe: Boolean(unsubscribeUrl),
    body: [
      `Thanks for joining the Havlo deals digest.`,
      ``,
      `Three mornings a week (Monday, Wednesday, and Friday), you'll get one email from this address with the strongest deals we found that day. We don't email on the other days. If there's nothing new worth opening, we don't send anything.`,
      ``,
      `Until the first one ships, browse what's hot today: ${dealsUrl}`,
      ...(unsubscribeUrl ? [``, `Changed your mind? Unsubscribe in one click: ${unsubscribeUrl}`] : []),
    ],
  });

  return { subject, text, html };
}
