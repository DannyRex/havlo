#!/usr/bin/env tsx
/* Send every email template to a single inbox for visual review.
   Useful when iterating on src/lib/email/templates/ — fires all 6
   variants (digest overall + category, welcome, waitlist, notify,
   match-found) to one address with [PREVIEW] subject prefixes so
   they're distinguishable from real production sends.

   Usage:
     npx tsx --tsconfig tsconfig.scripts.json scripts/preview-emails.ts --to=you@example.com

   Costs ~6 Resend sends. Don't fire against unknown addresses. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}

import { newsletterDigest }              from "../src/lib/email/templates/newsletter-digest";
import { newsletterWelcome }             from "../src/lib/email/templates/newsletter-welcome";
import { cashbackWaitlistConfirmation }  from "../src/lib/email/templates/cashback-waitlist";
import { notifyProductConfirmation }     from "../src/lib/email/templates/notify-product";
import { notifyProductMatchFound }       from "../src/lib/email/templates/notify-product-match";
import { sendEmail }                     from "../src/lib/email/send";

function parseTo(): string | null {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--to=")) return arg.slice("--to=".length);
  }
  return null;
}

const SAMPLE_DEALS = [
  { title: "Samsung Galaxy A26 5G 128GB Smartphone",            priceDisplay: "₦425,000", originalDisplay: "₦525,000", discountPercent: 19, storeName: "Konga",      url: "https://havlo.io/ng/deals" },
  { title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones", priceDisplay: "£249.99", originalDisplay: "£379.00", discountPercent: 34, storeName: "Currys",     url: "https://havlo.io/uk/deals" },
  { title: "Logitech MX Master 3S Wireless Mouse",              priceDisplay: "$79.99",  originalDisplay: "$99.99",  discountPercent: 20, storeName: "Best Buy",   url: "https://havlo.io/us/deals" },
  { title: "AirPods 4 with Active Noise Cancellation",          priceDisplay: "$149.00", originalDisplay: null,      discountPercent: 0,  storeName: "Apple",      url: "https://havlo.io/us/deals" },
  { title: "Apple Watch Series 10 GPS 42mm Aluminium",          priceDisplay: "£369.00", originalDisplay: "£399.00", discountPercent: 8,  storeName: "John Lewis", url: "https://havlo.io/uk/deals" },
];

const SAMPLE_MATCHES = [
  { title: "Apple AirPods Pro 2 with USB-C",  priceDisplay: "₦315,000", storeName: "3CHub", url: "https://havlo.io/ng/deals" },
  { title: "AirPods Pro 2nd Gen (Magsafe)",   priceDisplay: "₦329,500", storeName: "Slot",  url: "https://havlo.io/ng/deals" },
  { title: "Apple AirPods Pro 2 Sealed",      priceDisplay: "₦335,000", storeName: "Konga", url: "https://havlo.io/ng/deals" },
];

async function main() {
  const to = parseTo();
  if (!to) { console.error("✗ pass --to=address@example.com"); process.exit(1); }

  const renders = [
    { tag: "01-digest-overall",  email: newsletterDigest({ country: "ng", deals: SAMPLE_DEALS }) },
    { tag: "02-digest-category", email: newsletterDigest({ country: "ng", category: "phones", categoryLabel: "Phones", deals: SAMPLE_DEALS.slice(0, 3) }) },
    { tag: "03-welcome",         email: newsletterWelcome({ country: "ng" }) },
    { tag: "04-cashback",        email: cashbackWaitlistConfirmation({ country: "uk" }) },
    { tag: "05-notify-product",  email: notifyProductConfirmation({ query: "AirPods Pro 2", country: "ng" }) },
    { tag: "06-notify-match",    email: notifyProductMatchFound({ query: "AirPods Pro 2", country: "ng", offers: SAMPLE_MATCHES }) },
  ];

  console.log(`▶ Preview sends to ${to}\n`);

  let sent = 0;
  let failed = 0;
  for (const r of renders) {
    /* [PREVIEW] prefix keeps the test sends visually obvious in the
       inbox so they're never confused with real production sends to
       a subscriber's actual address. */
    const subject = `[PREVIEW] ${r.email.subject}`;
    const result  = await sendEmail({
      to,
      subject,
      text: r.email.text,
      html: r.email.html,
      tags: [
        { name: "category", value: "preview" },
        { name: "variant",  value: r.tag },
      ],
    });
    if (result.ok) {
      console.log(`  ✓ ${r.tag.padEnd(20)} "${subject}"`);
      sent++;
    } else {
      console.log(`  ✗ ${r.tag.padEnd(20)} ${result.error}`);
      failed++;
    }
    /* Pace to stay well under Resend free-tier rate limit. */
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\nDone. sent=${sent} failed=${failed}`);
}

main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
