/**
 * Debug script — takes a screenshot + dumps product-like element counts
 * Run: npm run debug:selectors
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITES = [
  { name: "Jumia",   url: "https://www.jumia.com.ng/flash-sales/" },
  { name: "Konga",   url: "https://www.konga.com/category/phones-tablets-5261" },
  { name: "Slot",    url: "https://www.slot.ng/product-category/smartphones/" },
  { name: "3C Hub",  url: "https://www.3chub.com/product-category/mobile-phones/" },
];

const SELECTORS_TO_TRY = [
  "article.prd",
  "article",
  "li.product",
  "ul.products li",
  "[class*='ProductCard']",
  "[class*='product-card']",
  "[class*='product_item']",
  "[class*='productCard']",
  "[class*='product-item']",
  "[data-test='product-card']",
  "[data-testid*='product']",
  ".product",
  "div[class*='product']",
  "[class*='item']",
  "[class*='card']",
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    locale: "en-NG",
  });

  // Only block heavy media, keep JS + CSS so sites render
  await context.route("**/*.{png,jpg,jpeg,webp,gif,mp4,woff2,ttf}", (r) => r.abort());

  const page = await context.newPage();

  for (const site of SITES) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`🔍 ${site.name}: ${site.url}`);
    console.log("─".repeat(60));

    try {
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Give JS a moment to render
      await page.waitForTimeout(3000);

      const pageTitle = await page.title();
      console.log(`📄 Title: "${pageTitle}"`);

      // Screenshot
      const screenshotPath = resolve(__dirname, `debug-${site.name.toLowerCase().replace(/\s/g, "-")}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 Screenshot saved`);

      // Try each selector
      console.log("\nSelector hits:");
      const results: Array<{ sel: string; count: number }> = [];

      for (const sel of SELECTORS_TO_TRY) {
        const count = await page.$$eval(sel, (els) => els.length).catch(() => 0);
        if (count > 2) {
          results.push({ sel, count });
          console.log(`  ✅ ${String(count).padStart(3)}  ${sel}`);
        }
      }

      if (results.length === 0) {
        console.log("  ❌ No product selectors matched");

        // Dump first 3000 chars of body HTML
        const bodyHtml = await page.$eval("body", (el) => el.innerHTML.slice(0, 3000)).catch(() => "");
        const htmlPath = resolve(__dirname, `debug-${site.name.toLowerCase().replace(/\s/g, "-")}.html`);
        writeFileSync(htmlPath, bodyHtml, "utf-8");
        console.log(`  📝 HTML snippet saved to scripts/debug-${site.name.toLowerCase().replace(/\s/g, "-")}.html`);
      } else {
        // For the best selector, show first item's text content
        const best = results.sort((a, b) => b.count - a.count)[0];
        const sample = await page.$eval(
          best.sel,
          (el) => el.textContent?.replace(/\s+/g, " ").slice(0, 200).trim()
        ).catch(() => "");
        console.log(`\n  Best: "${best.sel}" (${best.count} items)`);
        console.log(`  Sample: "${sample}"`);
      }
    } catch (err) {
      console.error(`  💥 Failed: ${err}`);

      // Still try screenshot on failure
      try {
        const screenshotPath = resolve(__dirname, `debug-${site.name.toLowerCase().replace(/\s/g, "-")}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`  📸 Error screenshot saved`);
      } catch {}
    }
  }

  await browser.close();
  console.log("\n✅ Debug complete\n");
}

main().catch(console.error);
