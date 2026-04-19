// DHgate markup inspector — runs on the GitHub Actions runner where DHgate
// actually serves real HTML (locally we get a 403 from Akamai). Dumps card
// markup, price-bearing elements, and any embedded product JSON to a single
// text file that the workflow uploads as a build artifact. Read the artifact
// to find the right semantic price selector and rebuild the parser.
//
// The workflow runs:   npx tsx scripts/inspect-dh.ts
// And uploads:         /tmp/dhgate-debug.txt and /tmp/dhgate.png

import { chromium } from "playwright";
import { writeFileSync } from "fs";

const OUT = "/tmp/dhgate-debug.txt";
const SHOT = "/tmp/dhgate.png";

const lines: string[] = [];
const log = (...args: unknown[]) => {
  const s = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ");
  lines.push(s);
  console.log(s);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });
  const page = await ctx.newPage();

  const url = "https://www.dhgate.com/wholesale/cell+phones.html";
  log("=== DHgate inspector ===");
  log("URL:", url);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    log("goto error:", String(e));
  }
  await page.waitForTimeout(4000);
  // Lazy load
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(1500);

  log("\n--- Page meta ---");
  log("title:", await page.title());
  log("final url:", page.url());
  const bodySnippet = await page.evaluate(() =>
    (document.body.textContent ?? "").trim().slice(0, 500),
  );
  log("body[0..500]:", bodySnippet);

  try {
    await page.screenshot({ path: SHOT, fullPage: false });
    log("screenshot:", SHOT);
  } catch (e) {
    log("screenshot error:", String(e));
  }

  // 1) Product link count + a few sample hrefs
  const linkInfo = await page.$$eval("a[href*='/product/']", (links) => ({
    count: links.length,
    samples: links.slice(0, 5).map((l) => l.getAttribute("href") ?? ""),
  }));
  log("\n--- Product links ---");
  log("count:", linkInfo.count);
  log("samples:", linkInfo.samples);

  // 2) ALL standalone $X.XX text nodes — gives us a tag/class catalog of what
  //    DHgate actually uses to render prices.
  const priceEls = await page.$$eval("*", (els) => {
    const out: Array<{ tag: string; cls: string; txt: string; parentCls: string; parentTag: string }> = [];
    for (const e of els as Element[]) {
      const txt = (e.textContent ?? "").trim();
      if (txt.length > 40 || txt.length < 2) continue;
      // Match "$1", "$1.00", "$1,234.56", "US $5.49", "US $5"
      if (!/^(US\s*)?\$\s*[\d.,]+$/i.test(txt)) continue;
      // Skip if this is just a wrapper that has the same text as a child (avoid duplicates)
      const onlyChild = e.children.length === 1 && (e.children[0].textContent ?? "").trim() === txt;
      if (onlyChild) continue;
      out.push({
        tag: e.tagName.toLowerCase(),
        cls: e.getAttribute("class")?.slice(0, 100) ?? "",
        txt,
        parentTag: e.parentElement?.tagName.toLowerCase() ?? "",
        parentCls: e.parentElement?.getAttribute("class")?.slice(0, 100) ?? "",
      });
      if (out.length >= 60) break;
    }
    return out;
  });
  log("\n--- Standalone $X.XX nodes (up to 60) ---");
  for (const p of priceEls) {
    log(`  <${p.tag} class="${p.cls}"> "${p.txt}"   inside <${p.parentTag} class="${p.parentCls}">`);
  }

  // 3) For each of the first 5 product cards, dump the full outerHTML so we can
  //    eyeball the structure and find the price/strikethrough selector.
  const cards = await page.$$eval("a[href*='/product/']", (links) => {
    const seen = new Set<string>();
    const out: Array<{ idx: number; href: string; cardCls: string; html: string }> = [];
    for (let i = 0; i < links.length && out.length < 5; i++) {
      const link = links[i];
      const href = (link.getAttribute("href") ?? "").split("?")[0];
      if (!href.includes("/product/") || seen.has(href)) continue;
      seen.add(href);
      let card: Element | null = link;
      for (let j = 0; j < 10 && card; j++) {
        const cls = card.getAttribute("class") ?? "";
        if (/gallery|galleryitem|item|product|card|listitem/i.test(cls) && card !== link) break;
        card = card.parentElement;
      }
      if (!card) continue;
      out.push({
        idx: out.length,
        href,
        cardCls: card.getAttribute("class") ?? "",
        // Truncate to 5 KB per card so the artifact stays small
        html: (card as HTMLElement).outerHTML.slice(0, 5000),
      });
    }
    return out;
  });
  log("\n--- Sample product cards (first 5, full outerHTML) ---");
  for (const c of cards) {
    log(`\n### CARD #${c.idx}  href=${c.href}`);
    log(`cardClass: ${c.cardCls}`);
    log("html:");
    log(c.html);
  }

  // 4) Look for embedded JSON-LD and __NEXT_DATA__ / window.__INITIAL_STATE__
  //    — many ecom sites stash structured product data here, which would let us
  //    skip text parsing entirely.
  const scripts = await page.$$eval("script", (ss) =>
    ss
      .map((s) => ({
        type: s.getAttribute("type") ?? "",
        id: s.getAttribute("id") ?? "",
        len: (s.textContent ?? "").length,
        head: (s.textContent ?? "").slice(0, 200),
      }))
      .filter((s) =>
        s.type.includes("ld+json") ||
        s.id === "__NEXT_DATA__" ||
        /price|product|offer/i.test(s.head),
      )
      .slice(0, 8),
  );
  log("\n--- Structured-data scripts on page ---");
  for (const s of scripts) {
    log(`  type="${s.type}"  id="${s.id}"  len=${s.len}`);
    log(`    head: ${s.head.replace(/\s+/g, " ").slice(0, 180)}`);
  }

  // 5) A short list of the most distinctive class-name fragments seen on the
  //    page — useful for quickly spotting "is there a .price-current class?".
  const classFreq = await page.$$eval("[class]", (els) => {
    const freq = new Map<string, number>();
    for (const e of els.slice(0, 4000)) {
      const cls = e.getAttribute("class") ?? "";
      for (const tok of cls.split(/\s+/)) {
        if (!tok) continue;
        if (!/price|cost|usd|sale|orig|discount|promo|deal|coupon|crossed|through|del|old|cur/i.test(tok)) continue;
        freq.set(tok, (freq.get(tok) ?? 0) + 1);
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  });
  log("\n--- Price-ish class tokens (frequency) ---");
  for (const [cls, n] of classFreq) {
    log(`  ${n.toString().padStart(4)}  .${cls}`);
  }

  await browser.close();
  writeFileSync(OUT, lines.join("\n"));
  console.log(`\nWrote ${OUT}`);
})().catch((e) => {
  console.error("FATAL:", e);
  writeFileSync(OUT, lines.join("\n") + "\n\nFATAL: " + String(e));
  process.exit(0); // exit 0 so the workflow uploads the partial artifact
});
