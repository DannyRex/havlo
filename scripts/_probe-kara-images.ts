/* One-off probe — get a few Kara product URLs + fetch their og:image
   directly to see what the merchant's product pages actually expose.
   Decides whether we can populate images via a simple HTML fetch +
   og:image extraction (the cheap path) or whether we need to self-
   host the bytes (the bulletproof but expensive path). */

try { process.loadEnvFile?.(".env.local"); } catch { /* env may be set externally */ }
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

async function fetchOgImage(url: string): Promise<{ ogImage: string | null; firstImg: string | null; status: number; size: number }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HavloBot/1.0; +https://havlo.io)" },
      redirect: "follow",
    });
    const html = await res.text();
    const ogM = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
              ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twM = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const imgM = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i);
    return {
      ogImage:  ogM?.[1] ?? twM?.[1] ?? null,
      firstImg: imgM?.[1] ?? null,
      status:   res.status,
      size:     html.length,
    };
  } catch (e) {
    return { ogImage: null, firstImg: null, status: 0, size: 0 };
  }
}

async function main() {
  const supa = getSupabaseAdmin();
  const { data } = await supa
    .from("offers")
    .select("url, product_id, products!inner(id, title, image_url)")
    .eq("store_id", "kara")
    .limit(8);

  if (!data || data.length === 0) {
    console.log("No Kara offers found.");
    return;
  }

  for (const r of data as Array<{ url: string; product_id: string; products: { id: string; title: string; image_url: string | null } }>) {
    const p = r.products;
    console.log(`\n${p.title}`);
    console.log(`  product_id: ${p.id}`);
    console.log(`  current image_url: ${p.image_url ?? "NULL"}`);
    console.log(`  product URL:  ${r.url}`);
    if (!r.url) { console.log("  (no URL — skip og fetch)"); continue; }
    const og = await fetchOgImage(r.url);
    console.log(`  HTTP ${og.status}, ${og.size} bytes`);
    console.log(`  og:image:    ${og.ogImage ?? "NONE"}`);
    console.log(`  first <img>: ${og.firstImg ?? "NONE"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
