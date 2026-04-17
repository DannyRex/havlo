import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  await ctx.route("**/*.{png,jpg,jpeg,webp,gif,woff2}", (r) => r.abort());
  const page = await ctx.newPage();

  await page.goto("https://www.konga.com/category/phones-tablets-5261", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Dump first 3 article elements' inner HTML
  const articles = await page.$$eval("article", (els) =>
    els.slice(0, 3).map((el) => ({
      html: el.innerHTML.slice(0, 800),
      text: el.textContent?.replace(/\s+/g, " ").slice(0, 300).trim(),
    }))
  );

  console.log("=== KONGA ARTICLE DUMP ===\n");
  articles.forEach((a, i) => {
    console.log(`\n--- Article ${i + 1} ---`);
    console.log("TEXT:", a.text);
    console.log("HTML:", a.html);
  });

  writeFileSync(resolve(__dirname, "debug-konga-articles.json"), JSON.stringify(articles, null, 2));
  console.log("\nSaved to debug-konga-articles.json");
  await browser.close();
}

main().catch(console.error);
