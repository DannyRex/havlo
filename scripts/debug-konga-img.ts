// @ts-ignore
import { chromium } from "playwright-extra";
// @ts-ignore
import StealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(StealthPlugin());

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-NG",
  });
  // NOTE: do NOT block image requests for this debug — we want to see what real loading does
  const page = await ctx.newPage();

  await page.goto("https://www.konga.com/category/phones-tablets-5261", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  await page.evaluate(async () => {
    const cards = Array.from(document.querySelectorAll("article"));
    for (const card of cards) {
      card.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => setTimeout(r, 800));
  });

  const stats = await page.$$eval("article", (cards) => {
    let total = 0, withImg = 0, withPlaceholder = 0;
    for (const card of cards) {
      const img = card.querySelector("img");
      if (!img) continue;
      total++;
      const src = img.getAttribute("src") ?? "";
      if (src.startsWith("http")) withImg++;
      else if (src.startsWith("data:")) withPlaceholder++;
    }
    return { total, withImg, withPlaceholder };
  });
  console.log("STATS:", stats);

  const dump = await page.$$eval("article", (cards) =>
    cards.slice(0, 5).map((card) => {
      const img = card.querySelector("img");
      const picture = card.querySelector("picture");
      const allImgs = Array.from(card.querySelectorAll("img")).length;
      const sources = picture ? Array.from(picture.querySelectorAll("source")).map((s) => ({
        srcset: s.getAttribute("srcset")?.slice(0, 120),
        type: s.getAttribute("type"),
      })) : [];
      const attrs: Record<string, string | null> = {};
      if (img) {
        for (const a of Array.from(img.attributes)) {
          attrs[a.name] = a.value.length > 200 ? a.value.slice(0, 200) + "…" : a.value;
        }
      }
      // Background image on parent?
      let bg = "";
      let el: Element | null = card;
      for (let i = 0; i < 4 && el; i++) {
        const s = (el as HTMLElement).style?.backgroundImage;
        if (s && s !== "none") { bg = s.slice(0, 200); break; }
        el = el.parentElement;
      }
      return { hasImg: !!img, allImgs, attrs, sources, bg, html: card.innerHTML.slice(0, 600) };
    })
  );

  console.log(JSON.stringify(dump, null, 2));

  await browser.close();
}
main().catch(console.error);
