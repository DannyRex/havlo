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
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0057FF;">Havlo</p>
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
                Thanks for joining the Havlo cashback list.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">
                Phase 1 is the explainer page. Phase 2 is the part you actually want: real accounts, real payouts, real cashback on every qualifying order through Havlo. We're a few weeks out from that going live.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.55;color:#0f172a;">
                When it does, you'll be the first to know via this address. No noise in between.
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
                One email per phase. Reply with "remove" and we'll drop you from the list.
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
