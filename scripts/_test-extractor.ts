try { process.loadEnvFile?.(".env.local"); } catch {}

function findProductNodes(value: any, out: any[] = []): any[] {
  if (!value) return out;
  if (Array.isArray(value)) { for (const v of value) findProductNodes(v, out); return out; }
  if (typeof value !== "object") return out;
  const obj = value;
  const type = obj["@type"];
  const isProduct =
    type === "Product" ||
    (Array.isArray(type) && type.some((t: any) => typeof t === "string" && /Product/i.test(t)));
  if (isProduct) out.push(obj);
  for (const key of ["@graph", "itemListElement", "mainEntity", "offers", "hasPart"]) {
    if (obj[key]) findProductNodes(obj[key], out);
  }
  return out;
}

function pickString(v: any): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    if (typeof v.name === "string") return v.name.trim() || undefined;
    if (typeof v["@value"] === "string") return v["@value"].trim() || undefined;
  }
  return undefined;
}

function extract(p: any) {
  let gtin = pickString(p.gtin) ?? pickString(p.gtin13) ?? pickString(p.gtin12) ?? pickString(p.gtin14) ?? pickString(p.gtin8);
  let mpn = pickString(p.mpn);
  let sku = pickString(p.sku);
  const brand = pickString(p.brand);

  if (!gtin || !mpn || !sku) {
    const offers = Array.isArray(p.offers) ? p.offers : (p.offers ? [p.offers] : []);
    for (const o of offers) {
      if (!gtin) gtin = pickString(o.gtin) ?? pickString(o.gtin13) ?? pickString(o.gtin12) ?? pickString(o.gtin14) ?? pickString(o.gtin8);
      if (!mpn) mpn = pickString(o.mpn);
      if (!sku) sku = pickString(o.sku);
      if (gtin && mpn) break;
    }
  }
  return { gtin, mpn, sku, brand };
}

async function main() {
  const urls = [
    "https://www.essenza.ng/products/afnan-9-am",
    "https://healthplusnigeria.com/products/accuchek-active-blood-glucose-monitor",
    "https://www.supermart.ng/products/05-inch-tape-x12",
  ];
  for (const url of urls) {
    console.log(`\n${url}`);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" }, redirect: "follow" });
    const html = await res.text();
    const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block[1].trim());
        const products = findProductNodes(parsed);
        for (const p of products) {
          const ids = extract(p);
          if (ids.gtin || ids.mpn || ids.sku) {
            console.log("  HIT:", ids);
          }
        }
      } catch (e: any) {
        console.log("  json parse fail:", e.message.slice(0, 60));
      }
    }
  }
}
main().catch(console.error);
