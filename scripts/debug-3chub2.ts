import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto("https://www.3chub.com/collections/samsung-mobile-phone", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);

// Get all product links on the page
const products = await page.$$eval("a[href*='/products/']", (links) =>
  [...new Set(links.map(a => a.getAttribute("href") ?? ""))].slice(0, 8)
    .map(href => {
      const el = document.querySelector(`a[href="${href}"]`);
      // Walk up to find product card container
      let container = el?.parentElement;
      for (let i = 0; i < 5; i++) {
        if (!container) break;
        const text = container.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (text.includes("₦")) {
          return { href, text: text.slice(0, 250), tag: container.tagName + "." + container.className.slice(0, 50) };
        }
        container = container.parentElement;
      }
      return { href, text: el?.textContent?.trim() ?? "", tag: "none" };
    })
);

products.forEach((p, i) => {
  console.log(`\n[${i+1}] ${p.href}`);
  console.log("TEXT:", p.text);
  console.log("TAG:", p.tag);
});

await browser.close();
