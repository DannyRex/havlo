/* Confirmation email sent right after a user submits the cashback
   waitlist form on /[country]/cashback (Phase 1 — display-only).

   Voice: founder-led, plain English. No em-dashes. The launch
   announcement (Phase 2 — real accounts + payouts) is a separate
   broadcast email sent to the whole waitlist on go-live day. */

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

  const subject = "You're on the cashback list";

  const text = [
    `Hi,`,
    ``,
    `You're in. We're a few weeks from launching real cashback (actual accounts, actual payouts). When it ships, I'll email you here with what you've earned and how to withdraw.`,
    ``,
    `Until then, keep using Havlo to find cheaper across the stores you already know:`,
    dealsUrl,
    ``,
    `Daniel`,
    `Havlo`,
    ``,
    `--`,
    `No more email until launch. Reply "remove" anytime to drop off.`,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">
<p>Hi,</p>
<p>You're in. We're a few weeks from launching real cashback (actual accounts, actual payouts). When it ships, I'll email you here with what you've earned and how to withdraw.</p>
<p>Until then, keep using Havlo to find cheaper across the stores you already know: <a href="${dealsUrl}" style="color:#0057FF;">havlo.io/${cc}/deals</a></p>
<p>Daniel<br/><span style="color:#64748b;">Havlo</span></p>
<p style="color:#94a3b8;font-size:13px;margin-top:24px;">No more email until launch. Reply "remove" anytime to drop off.</p>
</div>`;

  return { subject, text, html };
}
