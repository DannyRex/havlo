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
  plainTextShell,
} from "./_layout";

interface Args {
  country: string | null;
}

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

const SITE_URL = "https://havlo.io";

export function newsletterWelcome({ country }: Args): Email {
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
`;

  const html = shellPersonal({ preheader, body });

  /* ── Plain text body ────────────────────────────────────────── */

  const text = plainTextShell({
    body: [
      `Thanks for joining the Havlo deals digest.`,
      ``,
      `Three mornings a week (Monday, Wednesday, and Friday), you'll get one email from this address with the strongest deals we found that day. We don't email on the other days. If there's nothing new worth opening, we don't send anything.`,
      ``,
      `Until the first one ships, browse what's hot today: ${dealsUrl}`,
    ],
  });

  return { subject, text, html };
}
