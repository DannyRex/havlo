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
  plainTextShell,
  button,
} from "./_layout";

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

  const html = shellPersonal({ preheader, body });

  const text = plainTextShell({
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
}

export function priceAlertTriggered({
  productTitle, targetPriceFmt, cheapestPriceFmt, storeName, productUrl,
  country, unsubscribeToken,
}: TriggeredArgs): Email {
  const cc = country.toLowerCase();
  void cc;
  const unsubUrl = `${SITE_URL}/unsubscribe-alert?token=${unsubscribeToken}`;

  const subject   = `${productTitle.slice(0, 55)} is now ${cheapestPriceFmt}`;
  const preheader = `Below your target of ${targetPriceFmt}. View the offer at ${storeName}.`;

  const body = `
${paragraph("Good news -")}
${paragraph(`<strong style="font-weight:600;">${escapeHtml(productTitle)}</strong> just dropped to <strong style="font-weight:600;">${escapeHtml(cheapestPriceFmt)}</strong> at ${escapeHtml(storeName)}.`)}
${paragraph(`That's below your target of ${escapeHtml(targetPriceFmt)}.`)}
${button({ url: productUrl, label: `View at ${storeName}`, align: "left" })}
${spacer(16)}
${paragraph(`Prices change fast at this level. If you want it, grab it now.`)}
${signature("Danny")}
${spacer(8)}
${paragraph(`<span style="font-size:12px;color:#9ca3af;">${textLink({ url: unsubUrl, label: "Stop tracking this product" })}.</span>`)}
`;

  const html = shellPersonal({ preheader, body });

  const text = plainTextShell({
    body: [
      `Good news -`,
      ``,
      `"${productTitle}" just dropped to ${cheapestPriceFmt} at ${storeName}.`,
      `That's below your target of ${targetPriceFmt}.`,
      ``,
      `View at ${storeName}: ${productUrl}`,
      ``,
      `Prices change fast at this level. If you want it, grab it now.`,
      ``,
      `Stop tracking this product: ${unsubUrl}`,
    ],
    signoff: "Danny",
  });

  return { subject, text, html };
}
