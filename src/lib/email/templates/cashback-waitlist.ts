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

  const subject = "You're on the Havlo cashback list";

  const text = [
    `Hey,`,
    ``,
    `Thanks for joining the Havlo cashback list.`,
    ``,
    `Phase 1 is the explainer page. Phase 2 is the part you actually want: real accounts, real payouts, real cashback on every qualifying order through Havlo. We're a few weeks out from that going live.`,
    ``,
    `When it does, you'll be the first to know via this address. No noise in between.`,
    ``,
    `In the meantime, the catalog keeps growing. Browse what's in today:`,
    dealsUrl,
    ``,
    `Cheers,`,
    `Daniel`,
    `Founder, Havlo`,
    ``,
    `--`,
    `One email per phase. Reply with "remove" and we'll drop you from the list.`,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">
<p>Hey,</p>
<p>Thanks for joining the Havlo cashback list.</p>
<p>Phase 1 is the explainer page. Phase 2 is the part you actually want: real accounts, real payouts, real cashback on every qualifying order through Havlo. We're a few weeks out from that going live.</p>
<p>When it does, you'll be the first to know via this address. No noise in between.</p>
<p>In the meantime, the catalog keeps growing. You can browse what's in today at <a href="${dealsUrl}" style="color:#0057FF;">havlo.io/${cc}/deals</a>.</p>
<p>Cheers,<br/>Daniel<br/><span style="color:#64748b;">Founder, Havlo</span></p>
<p style="color:#94a3b8;font-size:13px;margin-top:24px;">One email per phase. Reply with "remove" and we'll drop you from the list.</p>
</div>`;

  return { subject, text, html };
}
