/* Confirmation email for /for-merchants form submission.

   Internal-facing only goal is to set expectations ("we respond within
   2 business days"). Personal shell so it lands in Primary, not
   Promotions. The internal-side notification to hello@havlo.io
   happens via a separate sendEmail call in the API route. */

import {
  shellPersonal,
  paragraph,
  signature,
  spacer,
  escapeHtml,
  plainTextShell,
} from "./_layout";

interface Args {
  storeName: string;
}

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

export function merchantInquiryConfirmation({ storeName }: Args): Email {
  const subject   = `We got your application for ${storeName}`;
  const preheader = `We respond within two business days. If everything checks out, you'll be live shortly after.`;

  const body = `
${paragraph("Hi,")}
${paragraph(`Thanks for applying to list <strong style="font-weight:600;">${escapeHtml(storeName)}</strong> on Havlo.`)}
${paragraph("I'll review it in the next two business days and reply with next steps. Usually that's either a quick request for the product feed URL (if you didn't include it), or a green light to start ingestion.")}
${paragraph("Most partners go live within three business days after sign-off.")}
${signature("Danny")}
${spacer(8)}
`;

  const html = shellPersonal({ preheader, body, transactional: true });

  const text = plainTextShell({
    transactional: true,
    body: [
      `Thanks for applying to list "${storeName}" on Havlo.`,
      ``,
      `I'll review it in the next two business days and reply with next steps. Usually that's either a quick request for the product feed URL (if you didn't include it), or a green light to start ingestion.`,
      ``,
      `Most partners go live within three business days after sign-off.`,
    ],
    signoff: "Danny",
  });

  return { subject, text, html };
}

/* ── Internal notification ────────────────────────────────────────
   Bare-bones text email to hello@havlo.io so the team gets
   a Slack-like ping when a new inquiry lands. Plain text only —
   no need for layout chrome on an internal notification. */
interface InternalArgs {
  storeName:   string;
  email:       string;
  contactName: string | null;
  storeUrl:    string;
  feedUrl:     string | null;
  countries:   string | null;
  skuCount:    string | null;
  notes:       string | null;
}

export function merchantInquiryInternalNotification(a: InternalArgs): Email {
  const lines = [
    `New merchant inquiry: ${a.storeName}`,
    ``,
    `Contact:    ${a.contactName ?? "(not provided)"} <${a.email}>`,
    `Store URL:  ${a.storeUrl}`,
    `Feed URL:   ${a.feedUrl ?? "(none, ask for one)"}`,
    `Countries:  ${a.countries ?? "(not specified)"}`,
    `SKU count:  ${a.skuCount ?? "(not specified)"}`,
    ``,
    `Notes:`,
    a.notes ?? "(none)",
    ``,
    `--`,
    `Reply directly to ${a.email} to start the conversation.`,
  ];
  const text = lines.join("\n");
  return {
    subject: `Merchant inquiry: ${a.storeName}`,
    text,
    html:    `<pre style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.5">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] ?? c))}</pre>`,
  };
}
