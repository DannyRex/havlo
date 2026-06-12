/* Price-alert emails — two flavours:

   priceAlertConfirmation: sent immediately after the user creates
     an alert on a PDP. "We're watching this product, you'll hear
     from us when it hits {target}."

   priceAlertTriggered: sent by the cron when the alert's condition
     fires (cheapest in-country offer drops to or below the user's
     target). Carries the matching store + price + a deep link to
     the product page.

   Both share the existing personal shell so they land in Primary
   not Promotions. Footer carries the one-click unsubscribe link
   that DELETEs the row server-side (no login required — token
   possession = auth, same pattern as standard email unsubscribe
   conventions). */

import {
  shellPersonal,
  paragraph,
  signature,
  spacer,
  textLink,
  escapeHtml,
  escapeAttr,
  emailImageUrl,
  plainTextShell,
  button,
} from "./_layout";
import { displayStoreName } from "@/lib/store-display";

interface Email {
  subject: string;
  text:    string;
  html:    string;
}

const SITE_URL = "https://havlo.io";

interface ConfirmationArgs {
  productTitle: string;
  targetPriceFmt: string;   // pre-formatted with currency symbol
  country:      string;
  unsubscribeToken: string;
}

export function priceAlertConfirmation({
  productTitle, targetPriceFmt, country, unsubscribeToken,
}: ConfirmationArgs): Email {
  const cc = country.toLowerCase();
  const unsubUrl = `${SITE_URL}/unsubscribe-alert?token=${unsubscribeToken}`;
  const dealsUrl = `${SITE_URL}/${cc}/deals`;

  const subject = `Tracking ${productTitle.slice(0, 60)}${productTitle.length > 60 ? "…" : ""}`;
  const preheader = `When the price drops to ${targetPriceFmt} or below, we'll email you.`;

  const body = `
${paragraph("Hi,")}
${paragraph(`We're watching <strong style="font-weight:600;">${escapeHtml(productTitle)}</strong>. When the price drops to ${escapeHtml(targetPriceFmt)} or below at any store you can buy from, I'll email you with the link.`)}
${paragraph(`In the meantime, ${textLink({ url: dealsUrl, label: "see what's trending today" })}.`)}
${signature("Danny")}
${spacer(8)}
${paragraph(`<span style="font-size:12px;color:#9ca3af;">No longer want this alert? ${textLink({ url: unsubUrl, label: "Cancel it here" })}.</span>`)}
`;

  const html = shellPersonal({ preheader, body, bodyHasUnsubscribe: true });

  const text = plainTextShell({
    bodyHasUnsubscribe: true,
    body: [
      `We're watching "${productTitle}". When the price drops to ${targetPriceFmt} or below at any store you can buy from, I'll email you with the link.`,
      ``,
      `In the meantime, see what's trending today: ${dealsUrl}`,
      ``,
      `Cancel this alert: ${unsubUrl}`,
    ],
    signoff: "Danny",
  });

  return { subject, text, html };
}

interface TriggeredArgs {
  productTitle:    string;
  targetPriceFmt:  string;
  cheapestPriceFmt: string;
  storeName:       string;
  productUrl:      string;   // havlo.io/{country}/p/{offer_id}
  country:         string;
  unsubscribeToken: string;
  /** Product photo (June 2026). Optional — the email renders text-only
      without it. Raw merchant/Storage URL; emailImageUrl handles
      proxying. */
  productImageUrl?: string | null;
}

export function priceAlertTriggered({
  productTitle, targetPriceFmt, cheapestPriceFmt, storeName, productUrl,
  country, unsubscribeToken, productImageUrl,
}: TriggeredArgs): Email {
  const cc = country.toLowerCase();
  void cc;
  const unsubUrl = `${SITE_URL}/unsubscribe-alert?token=${unsubscribeToken}`;
  /* Clean the merchant string before it reaches the inbox. The cron
     passes the offer's raw storeName, which can be an
     "eBay - <seller-handle>" marketplace string; the same display
     normaliser every on-site label uses keeps the email saying
     "eBay" rather than leaking a seller handle into the subject
     preheader, body, and button. */
  const storeLabel = displayStoreName(storeName);

  const subject   = `${productTitle.slice(0, 55)} is now ${cheapestPriceFmt}`;
  const preheader = `Below your target of ${targetPriceFmt}. View the offer at ${storeLabel}.`;

  /* Product photo above the headline (June 2026). 120px, linked to the
     PDP, white background so transparent product PNGs stay legible in
     dark-mode clients. Personal-shell emails stay light, so this only
     renders when a photo exists. */
  const img = emailImageUrl(productImageUrl);
  const photoBlock = img
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
        <tr>
          <td>
            <a href="${escapeAttr(productUrl)}" style="text-decoration:none;">
              <img src="${escapeAttr(img)}" alt="" width="120" height="120"
                style="display:block;width:120px;height:120px;border-radius:10px;background-color:#ffffff;object-fit:cover;border:1px solid #e5e7eb;" />
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const body = `
${paragraph("Quick heads-up.")}
${photoBlock}
${paragraph(`<strong style="font-weight:600;">${escapeHtml(productTitle)}</strong> just dropped to <strong style="font-weight:600;">${escapeHtml(cheapestPriceFmt)}</strong> at ${escapeHtml(storeLabel)}.`)}
${paragraph(`That's below the target you set (${escapeHtml(targetPriceFmt)}).`)}
${button({ url: productUrl, label: `View at ${storeLabel}`, align: "left" })}
${spacer(16)}
${paragraph(`Prices at this level usually don't hold for long, so it's worth checking soon if you've been waiting.`)}
${signature("Danny")}
${spacer(8)}
${paragraph(`<span style="font-size:12px;color:#9ca3af;">${textLink({ url: unsubUrl, label: "Stop tracking this product" })}.</span>`)}
`;

  const html = shellPersonal({ preheader, body, bodyHasUnsubscribe: true });

  const text = plainTextShell({
    bodyHasUnsubscribe: true,
    body: [
      `Quick heads-up.`,
      ``,
      `"${productTitle}" just dropped to ${cheapestPriceFmt} at ${storeLabel}.`,
      `That's below the target you set (${targetPriceFmt}).`,
      ``,
      `View at ${storeLabel}: ${productUrl}`,
      ``,
      `Prices at this level usually don't hold for long, so it's worth checking soon if you've been waiting.`,
      ``,
      `Stop tracking this product: ${unsubUrl}`,
    ],
    signoff: "Danny",
  });

  return { subject, text, html };
}
