/* Confirmation email sent right after a user submits the cashback
   waitlist form on /[country]/cashback (Phase 1 — display-only).

   Visual treatment: personal shell. Same paragraph-prose structure
   as the newsletter welcome so the two confirmations feel like
   siblings, not different products. The launch announcement
   (Phase 2 — real accounts + payouts) is a separate broadcast
   email and will use the marketing shell. */

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

export function cashbackWaitlistConfirmation({ country }: Args): Email {
  const cc = (country ?? "ng").toLowerCase();
  const dealsUrl = `${SITE_URL}/${cc}/deals`;

  const subject   = "You're on the cashback list";
  const preheader = "We'll email you when cashback is ready. Until then, nothing.";

  /* ── HTML body ──────────────────────────────────────────────── */

  const body = `
${paragraph("Hi,")}
${paragraph(`You're in. Cashback (real money back on what you'd buy anyway) is still in build. When it's ready, I'll email you here with how it works, which stores qualify, and how withdrawals happen.`)}
${paragraph(`Until then, keep using Havlo to ${textLink({ url: dealsUrl, label: "find cheaper deals across the stores you already know" })}.`)}
${signature("Danny")}
${spacer(8)}
`;

  const html = shellPersonal({ preheader, body });

  /* ── Plain text body ────────────────────────────────────────── */

  const text = plainTextShell({
    body: [
      `You're in. Cashback (real money back on what you'd buy anyway) is still in build. When it's ready, I'll email you here with how it works, which stores qualify, and how withdrawals happen.`,
      ``,
      `Until then, keep using Havlo to find cheaper deals across the stores you already know: ${dealsUrl}`,
    ],
  });

  return { subject, text, html };
}
