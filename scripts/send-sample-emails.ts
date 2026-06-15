#!/usr/bin/env tsx
/* Send SAMPLE emails to a target inbox to verify deliverability + render.
   Sends the real templates through the real Resend pipeline, but does NOT
   touch the newsletter_subscribers table (so it's a pure test — no
   subscription state changes). Mirrors the digest-building logic in
   scripts/cron/send-newsletter.ts so the digest sample looks like the live
   one.

   Usage:
     npx tsx --tsconfig tsconfig.scripts.json scripts/send-sample-emails.ts [email] [country]
     # defaults: ekumdaniel@gmail.com  ng
*/

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { getActiveBrowseProvider } from "../src/lib/providers";
import { getCountry, filterDealsForCountry, formatLocal, USD_FX } from "../src/lib/country";
import { newsletterWelcome } from "../src/lib/email/templates/newsletter-welcome";
import { newsletterDigest } from "../src/lib/email/templates/newsletter-digest";
import { sendEmail } from "../src/lib/email/send";
import { unsubscribeLink } from "../src/lib/email/unsubscribe-token";
import { pdpUrlForDeal } from "../src/lib/pdp-url";
import type { Country } from "../src/lib/country";
import type { Deal } from "../src/types";

const SITE_URL = "https://havlo.io";
const to = (process.argv[2] || "ekumdaniel@gmail.com").toLowerCase();
const cc = (process.argv[3] || "ng").toLowerCase();

function priceInUserCurrency(amount: number, dealCurrency: string, country: Country): number {
  const dealCcy = dealCurrency as Country["currency"];
  if (dealCcy === country.currency) return Math.round(amount);
  const inUsd = dealCcy === "USD" ? amount : amount / (USD_FX[dealCcy] ?? 1);
  return Math.round(inUsd * (USD_FX[country.currency] ?? 1));
}

async function main() {
  const country = getCountry(cc);
  console.log(`▶ Sending sample emails to ${to} (country=${cc.toUpperCase()})\n`);

  /* 1) Welcome ----------------------------------------------------------- */
  const w = newsletterWelcome({ country: cc, unsubscribeUrl: unsubscribeLink(to) });
  const wr = await sendEmail({
    to, subject: w.subject, text: w.text, html: w.html,
    tags: [{ name: "category", value: "sample-welcome" }],
  });
  console.log(`  welcome  → ${wr.ok ? "sent (" + wr.id + ")" : "FAILED: " + wr.error}`);

  /* 2) Digest (built from live deals, same path as the cron) -------------- */
  const provider = await getActiveBrowseProvider();
  const raw = await provider.fetchDeals({ minDiscount: 10, sort: "discount", origin: "all" });
  const picks = filterDealsForCountry(raw, country).slice(0, 8);
  const deals = picks.map((d: Deal) => {
    const sale = priceInUserCurrency(d.salePrice, d.currency, country);
    const orig = priceInUserCurrency(d.originalPrice, d.currency, country);
    return {
      title:           d.title.slice(0, 80),
      priceDisplay:    formatLocal(sale, country),
      originalDisplay: d.originalPrice > d.salePrice ? formatLocal(orig, country) : null,
      discountPercent: d.discountPercent ?? 0,
      storeName:       d.storeName,
      url:             `${SITE_URL}${pdpUrlForDeal(country.code, d)}`,
      imageUrl:        d.imageUrl ?? null,
    };
  });

  if (deals.length === 0) {
    console.log(`  digest   → SKIPPED (no deals found for ${cc})`);
  } else {
    const dg = newsletterDigest({ country: cc, category: null, deals, unsubscribeUrl: unsubscribeLink(to) });
    const dr = await sendEmail({
      to, subject: dg.subject, text: dg.text, html: dg.html,
      tags: [{ name: "category", value: "sample-digest" }],
    });
    console.log(`  digest   → ${dr.ok ? "sent (" + dr.id + ")" : "FAILED: " + dr.error} — ${deals.length} deal(s)`);
  }

  console.log(`\nDone. Check ${to} (give it a minute; check spam too).`);
}

main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
