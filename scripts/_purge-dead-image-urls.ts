#!/usr/bin/env tsx
/* One-shot: NULL out image_url on products where the stored URL is
   either a logo (not a product photo) or a signed URL that's likely
   expired (S3 pre-signs typically last 7 days; anything in the DB
   today that was ingested > 1 week ago is dead).

   Pass --apply to write. */

try {
  // @ts-expect-error
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { getSupabaseAdmin } from "../src/lib/providers/db-client";

const APPLY = process.argv.includes("--apply");

const isSignedUrl = (u: string) =>
  /X-Amz-Signature|X-Amz-Credential|X-Goog-Signature|X-Goog-Credential/i.test(u);
const isLogoUrl = (u: string) =>
  /\/logo(?:[-_]\w+)?\.(png|jpg|jpeg|webp|svg)(\?|$)/i.test(u);
const isSerpapiProxy = (u: string) =>
  /^https?:\/\/serpapi\.com\/searches\//i.test(u);

async function fetchPaged<T>(
  supa: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string, select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: (qb: any) => any,
): Promise<T[]> {
  const PAGE = 1000; const out: T[] = []; let from = 0;
  while (true) {
    const q = filters(supa.from(table).select(select)).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function main() {
  const supa = getSupabaseAdmin();
  if (!supa) { console.error("no supabase"); process.exit(1); }

  console.log(`${APPLY ? "▶ APPLY" : "● DRY RUN"} — scanning products with image_url for dead patterns...`);

  const products = await fetchPaged<{ id: string; title: string; image_url: string | null }>(
    supa, "products", "id, title, image_url",
    (q) => q.not("image_url", "is", null),
  );

  const signed: typeof products = [];
  const logos:  typeof products = [];
  const proxy:  typeof products = [];
  for (const p of products) {
    if (!p.image_url) continue;
    if (isSignedUrl(p.image_url))       signed.push(p);
    else if (isLogoUrl(p.image_url))    logos.push(p);
    else if (isSerpapiProxy(p.image_url)) proxy.push(p);
  }

  console.log(`  signed-URL (likely expired):       ${signed.length}`);
  console.log(`  logo-URL (not a product photo):    ${logos.length}`);
  console.log(`  serpapi.com proxy (already 404):   ${proxy.length}`);
  console.log(`  total dead:                        ${signed.length + logos.length + proxy.length}`);

  if (signed.length > 0) {
    console.log(`\nSigned-URL samples:`);
    for (const p of signed.slice(0, 4)) {
      console.log(`  "${p.title.slice(0, 60)}"`);
      console.log(`    ${p.image_url!.slice(0, 100)}…`);
    }
  }
  if (logos.length > 0) {
    console.log(`\nLogo-URL samples:`);
    for (const p of logos.slice(0, 4)) {
      console.log(`  "${p.title.slice(0, 60)}"  →  ${p.image_url}`);
    }
  }

  if (!APPLY) {
    console.log(`\n● dry run — pass --apply to NULL out these image_urls`);
    return;
  }

  const ids = [...signed, ...logos, ...proxy].map((p) => p.id);
  if (ids.length === 0) { console.log("✓ nothing to clean"); return; }

  const CHUNK = 500;
  let cleared = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await supa.from("products").update({ image_url: null }).in("id", slice);
    if (error) console.warn(`  ! chunk ${i}: ${error.message}`);
    else cleared += slice.length;
  }
  console.log(`\n✓ cleared image_url on ${cleared} products`);
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
