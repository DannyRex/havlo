/* Twice-weekly deals digest - sent by scripts/cron/send-newsletter.ts
   right after the Mon + Thurs scrape cron finishes ingesting fresh
   inventory.

   Voice: founder-led, plain English. No em-dashes. Same structure
   as newsletter-welcome / cashback-waitlist so the brand tone reads
   consistent across every transactional touchpoint.

   Each subscriber gets country-local deals (their `country` column
   on newsletter_subscribers drives the filtering). Category-targeted
   subscribers (those who hit the "Get phones deals" widget on /deals)
   get only their slug; nulls get the catch-all roundup. */

interface DigestDeal {
  /** Cleaned title - what shows on the card. */
  title:           string;
  /** Display price string already formatted in the user's country
      currency (e.g. "₦425,000", "£249.99"). The template renders it
      verbatim so we don't have to pull currency-format helpers into
      this file. */
  priceDisplay:    string;
  /** Original price formatted the same way. Null when the merchant
      doesn't publish a 'was' price. */
  originalDisplay: string | null;
  discountPercent: number;
  storeName:       string;
  /** Absolute outbound URL - already routed through /api/go so the
      affiliate wrap fires on click. */
  url:             string;
}

interface Args {
  country: string | null;
  /** Optional category filter - when set, the digest covers a single
      category (phones, audio, …) and the subject/headline call it
      out. Null = cross-category roundup. */
  category?: string | null;
  /** Display name of the category for the subject line (e.g. "Phones",
      "Audio"). Not used when category is null. */
  categoryLabel?: string;
  /** The deals themselves - pre-filtered and ranked by the cron. */
  deals: DigestDeal[];
}

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

const SITE_URL = "https://havlo.io";

/* Founder voice opener varies slightly by category vs all to keep it
   feeling fresh week to week. Same structure either way: one sentence
   framing what's in this digest, then the list. */
function opener(category: string | null): string {
  if (category) {
    return `Here's today's strongest drops in this category. We checked the local catalog plus a handful of cross-border partners.`;
  }
  return `Here's today's strongest price drops across the stores you already know. We pulled these from this morning's scrape.`;
}

export function newsletterDigest({ country, category, categoryLabel, deals }: Args): Email {
  const cc = (country ?? "ng").toLowerCase();
  const dealsUrl = `${SITE_URL}/${cc}/deals`;

  const subject = category && categoryLabel
    ? `${deals.length} fresh ${categoryLabel} deals on Havlo today`
    : `${deals.length} fresh deals on Havlo today`;

  const intro = opener(category ?? null);

  /* Plain text version - readable in any email client, regardless of
     HTML rendering. Each deal gets a short block: title, price, store,
     direct link. */
  const dealLines: string[] = [];
  for (const d of deals) {
    dealLines.push(
      `${d.title}`,
      `  ${d.priceDisplay}${d.originalDisplay ? ` (was ${d.originalDisplay})` : ""}${d.discountPercent > 0 ? ` - ${d.discountPercent}% off` : ""} at ${d.storeName}`,
      `  ${d.url}`,
      ``,
    );
  }

  const text = [
    `Hi,`,
    ``,
    intro,
    ``,
    ...dealLines,
    `See more: ${dealsUrl}`,
    ``,
    `Daniel`,
    `Havlo`,
    ``,
    `--`,
    `Reply "remove" anytime to drop off the list.`,
  ].join("\n");

  /* HTML version - same content, lightly styled. Inline styles only
     (no <style> block) for max email-client compatibility. */
  const dealsHtml = deals.map((d) => `
<div style="border-top:1px solid #e2e8f0;padding:14px 0;">
  <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#0f172a;">${escape(d.title)}</p>
  <p style="margin:0 0 4px 0;font-size:14px;color:#1f2937;">
    <span style="font-weight:700;">${escape(d.priceDisplay)}</span>${
      d.originalDisplay
        ? ` <span style="color:#94a3b8;text-decoration:line-through;font-size:13px;">${escape(d.originalDisplay)}</span>`
        : ""
    }${
      d.discountPercent > 0
        ? ` <span style="color:#16a34a;font-weight:600;font-size:13px;">${d.discountPercent}% off</span>`
        : ""
    }
  </p>
  <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">at ${escape(d.storeName)}</p>
  <a href="${escape(d.url)}" style="display:inline-block;font-size:13px;color:#0057FF;text-decoration:none;">View deal &rarr;</a>
</div>`).join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;">
<p>Hi,</p>
<p>${escape(intro)}</p>
${dealsHtml}
<p style="margin-top:24px;">See more: <a href="${dealsUrl}" style="color:#0057FF;">havlo.io/${cc}/deals</a></p>
<p>Daniel<br/><span style="color:#64748b;">Havlo</span></p>
<p style="color:#94a3b8;font-size:13px;margin-top:24px;">Reply &ldquo;remove&rdquo; anytime to drop off the list.</p>
</div>`;

  return { subject, text, html };
}

/* Minimal HTML escape - prevents merchant titles or URLs containing
   ampersands / quotes / angle brackets from breaking the rendered
   email or being interpreted as markup. */
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
