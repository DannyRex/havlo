// Quick debug for just Jumia + Konga with domcontentloaded
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITES = [
  { name: "Jumia", url: "https://www.jumia.com.ng/flash-sales/" },
  { name: "Konga", url: "https://www.konga.com/category/phones-tablets-5261" },
];

const SELECTORS = [
  "article.prd", "article", "li.product", "[class*='ProductCard']",
  "[class*='product-card']", "[class*='product-item']", "[class*='prd']",
  "[data-test='product-card']", ".product", "section[class*='product']",
  "[class*='item']", "[class*='card']", "div[class*='prd']",
];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"] });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    locale: "en-NG",
  });
  await ctx.route("**/*.{png,jpg,jpeg,webp,gif,mp4,woff2}", (r) => r.abort());

  const page = await ctx.newPage();

  for (const site of SITES) {
    console.log(`\n── ${site.name} ──────────`);
    try {
      await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      const title = await page.title();
      console.log(`Title: "${title}"`);

      await page.screenshot({ path: resolve(__dirname, `debug-${site.name.toLowerCase()}.png`) });
      console.log("Screenshot saved");

      let found = false;
      for (const sel of SELECTORS) {
        const n = await page.$$eval(sel, (els) => els.length).catch(() => 0);
        if (n > 2) {
          console.log(`✅ ${String(n).padStart(4)}  ${sel}`);
          found = true;
        }
      }

      if (!found) {
        const html = await page.$eval("body", (b) => b.innerHTML.slice(0, 3000)).catch(() => "");
        writeFileSync(resolve(__dirname, `debug-${site.name.toLowerCase()}.html`), html);
        console.log("❌ No matches — HTML saved");
      }
    } catch (e) {
      console.log(`💥 ${e}`);
      try {
        const html = await page.$eval("body", (b) => b.innerHTML.slice(0, 3000)).catch(() => "");
        writeFileSync(resolve(__dirname, `debug-${site.name.toLowerCase()}.html`), html);
        await page.screenshot({ path: resolve(__dirname, `debug-${site.name.toLowerCase()}.png`) }).catch(() => null);
        console.log("HTML + screenshot saved despite error");
      } catch {}
    }
  }

  await browser.close();
  console.log("\nDone");
}

main().catch(console.error);
