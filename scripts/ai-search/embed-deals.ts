/**
 * Phase 2 — Embed deals into Supabase pgvector for semantic + visual search.
 *
 * Modes:
 *   --text    Embed title + search_terms → text_emb (OpenAI text-embedding-3-small, 1536d)
 *   --images  Embed product image        → image_emb (Cohere embed-v4.0 multimodal, 1024d)
 *   --all     Both (default)
 *
 * Incremental: skips rows whose text_hash / image_url_hash hasn't changed.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts --text
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts --images
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts --all
 *
 * Env required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY       (for --text)
 *   COHERE_API_KEY       (for --images — optional, skip if not set)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ─── Env loader ───────────────────────────────���──────────────────────────────
const PROJECT_ROOT = "/Users/admin/Dealesty";
const envPath = path.join(PROJECT_ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "").trim();
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────���
const MODE = process.argv.includes("--images") ? "images"
           : process.argv.includes("--text")   ? "text"
           : "all";

const TEXT_BATCH    = 100;    // OpenAI supports up to 2048 inputs per call
const IMAGE_BATCH   = 10;     // Cohere multimodal — keep small to avoid timeouts
const UPSERT_BATCH  = 50;     // Supabase upsert batch size
const COST_LOG_PATH = path.join(PROJECT_ROOT, "docs/ai-search/COST-LOG.md");

// Pricing
const OAI_PRICE_PER_MTOK  = 0.02;   // text-embedding-3-small: $0.02/1M tokens
const COHERE_PRICE_PER_IMG = 0.0001; // embed-v4.0 multimodal: ~$0.0001/image

// ─── Types ───────────────────────────────────────────────────────────────────
interface ExtractedEntry {
  brand: string | null;
  model: string | null;
  variant: string | null;
  product_type: string | null;
  storage_gb: number | null;
  ram_gb: number | null;
  inches: number | null;
  color: string | null;
  is_accessory: boolean;
  search_terms: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────���
function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function loadEnv(): { supa: ReturnType<typeof createClient>; openai: OpenAI } {
  const missing = [];
  if (!process.env.SUPABASE_URL)              missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.OPENAI_API_KEY && MODE !== "images") missing.push("OPENAI_API_KEY");
  if (missing.length) {
    console.error("❌ Missing env vars:", missing.join(", "));
    process.exit(1);
  }
  return {
    supa:   createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!),
    openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
  };
}

function appendCostLog(op: string, costUsd: number, details: string) {
  const date = new Date().toISOString().slice(0, 10);
  const row = `| ${date} | 2 | ${op} | — | — | — | — | — | $${costUsd.toFixed(4)} | ${details} |\n`;
  if (!fs.existsSync(COST_LOG_PATH)) return;
  const log = fs.readFileSync(COST_LOG_PATH, "utf8");
  const at = log.indexOf("\n## Rolling totals");
  fs.writeFileSync(COST_LOG_PATH, at === -1 ? log + row : log.slice(0, at) + row + log.slice(at));
}

// ─── Text embedding ──────────────────────────────────────────────────────────
async function embedText(
  deals: any[],
  extracted: Record<string, ExtractedEntry>,
  existing: Map<string, { text_hash: string }>,
  supa: ReturnType<typeof createClient>,
  openai: OpenAI,
): Promise<void> {
  // Determine which deals need (re-)embedding
  const todo = deals.filter((d) => {
    const text = `${d.title} ${extracted[d.id]?.search_terms ?? ""}`.trim();
    const hash = sha256(text);
    const row  = existing.get(d.id);
    return !row || row.text_hash !== hash;
  });

  console.log(`\n📝 Text embeddings: ${deals.length - todo.length} cached, ${todo.length} to embed`);
  if (todo.length === 0) return;

  let totalTokens = 0;
  let upserted = 0;

  for (let i = 0; i < todo.length; i += TEXT_BATCH) {
    const batch = todo.slice(i, i + TEXT_BATCH);
    const inputs = batch.map((d) =>
      `${d.title} ${extracted[d.id]?.search_terms ?? ""}`.trim().slice(0, 8000),
    );

    const resp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: inputs,
      encoding_format: "float",
    });

    totalTokens += resp.usage.total_tokens;

    // Prepare upsert rows
    const rows = batch.map((d, j) => {
      const ext = extracted[d.id];
      const text = inputs[j];
      return {
        id:           d.id,
        title:        d.title,
        category:     d.category,
        store_id:     d.storeId,
        price_ngn:    d.currency === "USD"
                        ? Math.round(d.salePrice * 1600)
                        : d.salePrice,
        image_url:    d.imageUrl ?? null,
        brand:        ext?.brand ?? null,
        model:        ext?.model ?? null,
        variant:      ext?.variant ?? null,
        product_type: ext?.product_type ?? null,
        storage_gb:   ext?.storage_gb ?? null,
        ram_gb:       ext?.ram_gb ?? null,
        inches:       ext?.inches ?? null,
        color:        ext?.color ?? null,
        is_accessory: ext?.is_accessory ?? false,
        search_terms: ext?.search_terms ?? null,
        text_emb:     resp.data[j].embedding,
        text_hash:    sha256(text),
        updated_at:   new Date().toISOString(),
      };
    });

    // Upsert in sub-batches
    for (let u = 0; u < rows.length; u += UPSERT_BATCH) {
      const { error } = await supa
        .from("deals_index")
        .upsert(rows.slice(u, u + UPSERT_BATCH), { onConflict: "id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
    }

    upserted += batch.length;
    const cost = (totalTokens / 1e6) * OAI_PRICE_PER_MTOK;
    const pct  = ((upserted / todo.length) * 100).toFixed(1);
    console.log(`  💾 ${upserted}/${todo.length} (${pct}%) — tokens: ${totalTokens.toLocaleString()} — cost: $${cost.toFixed(4)}`);
  }

  const finalCost = (totalTokens / 1e6) * OAI_PRICE_PER_MTOK;
  console.log(`\n✅ Text embeddings done — ${totalTokens.toLocaleString()} tokens — $${finalCost.toFixed(4)}`);
  appendCostLog(`embed-deals --text (${todo.length} deals)`, finalCost, `model=text-embedding-3-small tokens=${totalTokens}`);
}

// ─── Image embedding ─────────────────────────────────────────────────────────

/**
 * Fetch a remote image and return it as a base64 data URI.
 * Cohere embed-v4.0 requires "data:<mime>;base64,<data>" — not plain URLs.
 */
async function toBase64DataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const ct  = res.headers.get("content-type") ?? "image/jpeg";
    const mime = ct.split(";")[0].trim() || "image/jpeg";
    const buf  = await res.arrayBuffer();
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

async function embedImages(
  deals: any[],
  existing: Map<string, { image_url_hash: string | null }>,
  supa: ReturnType<typeof createClient>,
): Promise<void> {
  if (!process.env.COHERE_API_KEY) {
    console.log("\n⚠️  COHERE_API_KEY not set — skipping image embeddings.");
    console.log("   Add it to .env.local and re-run with --images");
    return;
  }

  // Only embed deals that have an image URL and whose URL has changed
  const todo = deals.filter((d) => {
    if (!d.imageUrl) return false;
    const hash = sha256(d.imageUrl);
    const row  = existing.get(d.id);
    return !row || row.image_url_hash !== hash;
  });

  const noImage = deals.filter((d) => !d.imageUrl).length;
  console.log(`\n🖼  Image embeddings: ${deals.length - todo.length - noImage} cached, ${noImage} no image, ${todo.length} to embed`);
  if (todo.length === 0) return;

  let totalImages = 0;
  let skipped = 0;

  for (let i = 0; i < todo.length; i += IMAGE_BATCH) {
    const batch = todo.slice(i, i + IMAGE_BATCH);

    // Fetch + encode all images in the batch to base64 data URIs in parallel
    const encoded = await Promise.all(batch.map((d) => toBase64DataUri(d.imageUrl)));

    // Only send deals whose image fetched successfully
    const valid = batch
      .map((d, j) => ({ deal: d, dataUri: encoded[j] }))
      .filter((x): x is { deal: any; dataUri: string } => x.dataUri !== null);

    skipped += batch.length - valid.length;
    if (valid.length === 0) continue;

    // Cohere embed-v4.0 multimodal via REST
    const response = await fetch("https://api.cohere.com/v2/embed", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "embed-v4.0",
        input_type: "image",
        embedding_types: ["float"],
        output_dimension: 1024,   // match image_emb vector(1024) in schema
        images: valid.map((x) => x.dataUri),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`  ✗ Cohere error (batch ${i}): ${err.slice(0, 200)}`);
      // Back off on rate limit errors
      if (response.status === 429) await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }

    const data = await response.json() as { embeddings: { float: number[][] } };
    const embeddings = data.embeddings.float;

    // Upsert image_emb + image_url_hash
    const rows = valid.map((x, j) => ({
      id:             x.deal.id,
      title:          x.deal.title,
      category:       x.deal.category,
      store_id:       x.deal.storeId,
      price_ngn:      x.deal.currency === "USD" ? Math.round(x.deal.salePrice * 1600) : x.deal.salePrice,
      image_url:      x.deal.imageUrl,
      image_emb:      embeddings[j],
      image_url_hash: sha256(x.deal.imageUrl),
      updated_at:     new Date().toISOString(),
    }));

    for (let u = 0; u < rows.length; u += UPSERT_BATCH) {
      const { error } = await supa
        .from("deals_index")
        .upsert(rows.slice(u, u + UPSERT_BATCH), { onConflict: "id" });
      if (error) throw new Error(`Upsert failed: ${error.message}`);
    }

    totalImages += valid.length;
    const cost = totalImages * COHERE_PRICE_PER_IMG;
    const pct  = ((( totalImages + skipped) / todo.length) * 100).toFixed(1);
    console.log(`  🖼  ${totalImages}/${todo.length} embedded, ${skipped} skipped (${pct}%) — cost: $${cost.toFixed(4)}`);

    // Trial key: 100 API calls/min → 600 ms between batches keeps us at ~100/min
    await new Promise((r) => setTimeout(r, 650));
  }

  const finalCost = totalImages * COHERE_PRICE_PER_IMG;
  console.log(`\n✅ Image embeddings done — ${totalImages} images (${skipped} skipped) — $${finalCost.toFixed(4)}`);
  appendCostLog(`embed-deals --images (${totalImages} deals)`, finalCost, `model=embed-v4.0`);
}

// ─── Main ──────────────────────────────────────────────────────────────────��─
async function main(): Promise<void> {
  const { supa, openai } = loadEnv();

  // Load deals + extracted data
  const { deals } = await import("../../src/lib/data/deals");
  const extracted: Record<string, ExtractedEntry> = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, "data/ai-search/extracted.json"), "utf8"),
  );

  console.log(`📊 Catalog: ${deals.length} deals | Mode: ${MODE}`);

  // Fetch existing rows from Supabase (just the hash columns — lightweight)
  const { data: existingRows, error } = await supa
    .from("deals_index")
    .select("id, text_hash, image_url_hash");
  if (error) throw new Error(`Failed to fetch existing rows: ${error.message}`);

  const existing = new Map(
    (existingRows ?? []).map((r: any) => [r.id, { text_hash: r.text_hash, image_url_hash: r.image_url_hash }]),
  );
  console.log(`   Already in Supabase: ${existing.size} rows`);

  if (MODE === "text" || MODE === "all")    await embedText(deals, extracted, existing, supa, openai);
  if (MODE === "images" || MODE === "all")  await embedImages(deals, existing, supa);

  console.log("\n✅ embed-deals complete.");
  console.log("Next: check docs/ai-search/ROADMAP.md §2.5 (vector.ts implementation)");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
