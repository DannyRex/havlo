/* Welcome email sent right after a user subscribes to the deals
   digest via the homepage 'Stay in the loop' strip.

   Cadence: twice-weekly (Monday + Thursday morning), matching the
   scrape cron — we only email when there's actually new data, not
   on idle days. This both respects the inbox and keeps each send
   carrying fresh content.

   Voice: founder-led, plain English. No em-dashes. Same template
   structure as notify-product / cashback-waitlist confirmations
   so the brand voice reads consistent across every transactional
   touchpoint. */

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

  const subject = "You're in. First Havlo digest lands Monday or Thursday.";

  const text = [
    `Hi,`,
    ``,
    `Thanks for joining the Havlo deals digest.`,
    ``,
    `Twice a week (Monday and Thursday morning), you'll get one email from this address with the strongest deals we found that day. We don't email on the other days. If there's nothing new worth opening, we don't send anything.`,
    ``,
    `Until the first one ships, browse what's hot today: ${dealsUrl}`,
    ``,
    `Daniel`,
    `Havlo`,
    ``,
    `--`,
    `Reply "remove" anytime to drop off the list.`,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">
<p>Hi,</p>
<p>Thanks for joining the Havlo deals digest.</p>
<p>Twice a week (Monday and Thursday morning), you'll get one email from this address with the strongest deals we found that day. We don't email on the other days. If there's nothing new worth opening, we don't send anything.</p>
<p>Until the first one ships, browse what's hot today: <a href="${dealsUrl}" style="color:#0057FF;">havlo.io/${cc}/deals</a></p>
<p>Daniel<br/><span style="color:#64748b;">Havlo</span></p>
<p style="color:#94a3b8;font-size:13px;margin-top:24px;">Reply &ldquo;remove&rdquo; anytime to drop off the list.</p>
</div>`;

  return { subject, text, html };
}
