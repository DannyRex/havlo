/**
 * Phase 1 — LLM extraction of structured product data.
 *
 * For each deal in src/lib/data/deals.ts, calls Haiku 4.5 to extract a
 * canonical `{brand, model, variant, storage_gb, ram_gb, inches, color,
 * product_type, is_accessory, confidence, search_terms}` JSON object.
 *
 * Results are cached in data/ai-search/extracted.json keyed by:
 *   sha256(PROMPT_VERSION + title + description)
 *
 * Re-runs are incremental: only new/changed deals hit the API.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/extract-products.ts
 *
 * Env required: ANTHROPIC_API_KEY
 *
 * See: docs/ai-search/PROMPTS.md (extract-v1) and docs/ai-search/ROADMAP.md §1.1
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Load .env.local automatically — try multiple candidate roots since
// process.cwd() and __dirname can vary depending on how tsx is invoked.
function loadEnv(): void {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.resolve(process.argv[1], "../../..", ".env.local"), // scripts/ai-search/<file> → root
    "/Users/admin/Dealesty/.env.local",                     // absolute fallback
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "").trim();
    }
    break;
  }
}
loadEnv();

import { deals } from "../../src/lib/data/deals";

// ─── Config ─────────────────────────────────────────────────────────────────
const PROMPT_VERSION = "extract-v1";
const MODEL          = "claude-haiku-4-5";
const BATCH_SIZE     = 4;           // Tier 1 limit: 50 req/min → 4 concurrent is safe
const MAX_RETRIES    = 6;           // more retries with longer backoff for rate limits
const FLUSH_EVERY    = 50;          // write cache to disk every N deals
const PROJECT_ROOT   = "/Users/admin/Dealesty";
const OUT_PATH       = path.join(PROJECT_ROOT, "data/ai-search/extracted.json");
const COST_LOG_PATH  = path.join(PROJECT_ROOT, "docs/ai-search/COST-LOG.md");

// Haiku 4.5 pricing as of 2026-04-23 (verify on console.anthropic.com)
const PRICE_INPUT_PER_MTOK  = 1.00;  // $/1M input tokens
const PRICE_OUTPUT_PER_MTOK = 5.00;  // $/1M output tokens

// ─── Types ──────────────────────────────────────────────────────────────────
interface Extracted {
  brand: string | null;
  model: string | null;
  variant: string | null;
  product_type: string | null;
  storage_gb: number | null;
  ram_gb: number | null;
  inches: number | null;
  color: string | null;
  is_accessory: boolean;
  confidence: "high" | "medium" | "low";
  search_terms: string;

  // Cache metadata
  _hash: string;
  _promptVersion: string;
  _model: string;
  _extractedAt: string;
}

type Cache = Record<string /* dealId */, Extracted>;

// ─── Prompt (matches docs/ai-search/PROMPTS.md extract-v1) ──────────────────
const SYSTEM_PROMPT = `You are a product-data extraction engine for a Nigerian price-comparison site.
Given a raw product listing (title + short description) from a retailer like
Jumia, Konga, Slot, Amazon, AliExpress, ASOS, you extract structured fields.

Rules:
- Return ONLY the structured JSON via the extract_product tool. No prose.
- Be conservative: if you are not >70% sure of a field, return null.
- "brand" is the manufacturer (apple, samsung, tecno) NOT the retailer.
- "model" is the specific product line (e.g. "iphone 15 pro", "galaxy a06",
  "spark 30") — lowercase, no extra adjectives.
- "variant" captures sub-model differentiators (e.g. "ultra", "pro max", "fe").
- "product_type" is one of the controlled values listed in the tool schema.
- "storage_gb" and "ram_gb" are integers (convert TB → GB by ×1024).
- "inches" is a number (TVs: integer 19-120; phones/tablets: float like 6.5).
- "color" is the primary color, lowercased single word ("black", "rosegold").
- "is_accessory" is true for cases, cables, chargers, screen protectors,
  remotes, holders, replacement parts. False for the actual device.
- "search_terms" is a clean, normalized phrase a shopper would actually type
  to find THIS product (e.g. "samsung galaxy a06 128gb"). 2-6 words. Lowercase.

When a title lists multiple storage variants (e.g. "64GB+4GB & 128GB+4GB"),
pick the LARGEST storage. Put RAM in ram_gb separately.`;

const TOOL = {
  name: "extract_product",
  description: "Extract structured fields from a product listing",
  input_schema: {
    type: "object" as const,
    properties: {
      brand:        { type: ["string", "null"] },
      model:        { type: ["string", "null"] },
      variant:      { type: ["string", "null"] },
      product_type: {
        type: ["string", "null"],
        enum: [
          "flagship-phone", "budget-phone", "tablet",
          "premium-laptop", "laptop", "desktop", "monitor",
          "premium-earbuds", "earbuds", "headphones", "speaker", "soundbar",
          "tv", "console", "smartwatch", "camera",
          "fridge", "washer", "ac", "microwave", "fan", "blender",
          "sneakers", "dress", "outerwear", "tops", "bottoms", "bags", "watch",
          "skincare", "haircare", "fragrance", "makeup",
          "accessory", "other", null,
        ],
      },
      storage_gb:   { type: ["integer", "null"], minimum: 1, maximum: 4096 },
      ram_gb:       { type: ["integer", "null"], minimum: 1, maximum: 256 },
      inches:       { type: ["number",  "null"], minimum: 0.5, maximum: 200 },
      color:        { type: ["string",  "null"] },
      is_accessory: { type: "boolean" },
      confidence:   { type: "string", enum: ["high", "medium", "low"] },
      search_terms: { type: "string", minLength: 2, maxLength: 60 },
    },
    required: ["is_accessory", "confidence", "search_terms"],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function hashOf(title: string, description: string): string {
  return crypto
    .createHash("sha256")
    .update(`${PROMPT_VERSION}\n${title}\n${description}`)
    .digest("hex")
    .slice(0, 16);
}

function loadCache(): Cache {
  if (!fs.existsSync(OUT_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
  } catch (e) {
    console.error(`⚠️  Could not parse existing cache, starting fresh: ${e}`);
    return {};
  }
}

function saveCache(cache: Cache): void {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(cache, null, 2));
}

function appendCostLog(opTokensIn: number, opTokensOut: number, cost: number, dealsProcessed: number): void {
  const date = new Date().toISOString().slice(0, 10);
  const row = `| ${date} | 1 | extract-products (${dealsProcessed} deals) | Anthropic | ${MODEL} | ${opTokensIn} | ${opTokensOut} | — | $${cost.toFixed(4)} | prompt=${PROMPT_VERSION} |\n`;
  // Insert before the "## Rolling totals" line
  const log = fs.readFileSync(COST_LOG_PATH, "utf8");
  const insertAt = log.indexOf("\n## Rolling totals");
  if (insertAt === -1) {
    fs.appendFileSync(COST_LOG_PATH, row);
  } else {
    fs.writeFileSync(COST_LOG_PATH, log.slice(0, insertAt) + row + log.slice(insertAt));
  }
}

async function extractOne(
  client: Anthropic,
  deal: { id: string; title: string; description: string; category: string; storeName: string },
): Promise<{ extracted: Extracted; tokensIn: number; tokensOut: number }> {
  const userMessage = `Title: ${deal.title}
Description: ${deal.description}
Category: ${deal.category}
Store: ${deal.storeName}

Extract the structured fields.`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "extract_product" },
        messages: [{ role: "user", content: userMessage }],
      });

      const toolUse = response.content.find((b: any) => b.type === "tool_use") as
        | { type: "tool_use"; input: Record<string, unknown> }
        | undefined;
      if (!toolUse) throw new Error("No tool_use block in response");

      const input = toolUse.input as Partial<Extracted>;
      const extracted: Extracted = {
        brand:         (input.brand as string | null)         ?? null,
        model:         (input.model as string | null)         ?? null,
        variant:       (input.variant as string | null)       ?? null,
        product_type:  (input.product_type as string | null)  ?? null,
        storage_gb:    (input.storage_gb as number | null)    ?? null,
        ram_gb:        (input.ram_gb as number | null)        ?? null,
        inches:        (input.inches as number | null)        ?? null,
        color:         (input.color as string | null)         ?? null,
        is_accessory:  (input.is_accessory as boolean)        ?? false,
        confidence:    (input.confidence as Extracted["confidence"]) ?? "low",
        search_terms:  (input.search_terms as string)         ?? deal.title.toLowerCase().slice(0, 60),
        _hash:           hashOf(deal.title, deal.description),
        _promptVersion:  PROMPT_VERSION,
        _model:          MODEL,
        _extractedAt:    new Date().toISOString(),
      };

      return {
        extracted,
        tokensIn:  response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
      };
    } catch (err) {
      lastErr = err;
      // Rate limit (429): wait longer — respect the 60s window
      const isRateLimit = (err as any)?.status === 429;
      const wait = isRateLimit
        ? 15_000 * attempt               // 15s, 30s, 45s... on rate limit
        : 500 * Math.pow(2, attempt - 1); // 500ms, 1s, 2s... on other errors
      console.warn(`  ↻ retry ${attempt}/${MAX_RETRIES} for ${deal.id} in ${Math.round(wait/1000)}s (${isRateLimit ? "rate limit" : (err as Error).message})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set. See docs/ai-search/ROADMAP.md §0.1");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const cache = loadCache();

  // Decide which deals need extraction
  const todo: typeof deals = [];
  for (const d of deals) {
    const existing = cache[d.id];
    const currentHash = hashOf(d.title, d.description);
    if (existing && existing._hash === currentHash && existing._promptVersion === PROMPT_VERSION) {
      continue; // already extracted with current prompt + same content
    }
    todo.push(d);
  }

  console.log(`📊 Catalog: ${deals.length} deals | Cached: ${deals.length - todo.length} | To extract: ${todo.length}`);
  if (todo.length === 0) {
    console.log("✅ Cache is up-to-date. Nothing to do.");
    return;
  }

  let totalIn = 0;
  let totalOut = 0;
  let processed = 0;
  const startTime = Date.now();

  // Process in batches of BATCH_SIZE in-flight
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((d) => extractOne(client, d)));

    for (let j = 0; j < batch.length; j++) {
      const deal = batch[j];
      const r = results[j];
      if (r.status === "fulfilled") {
        cache[deal.id] = r.value.extracted;
        totalIn  += r.value.tokensIn;
        totalOut += r.value.tokensOut;
        processed++;
      } else {
        console.error(`  ✗ ${deal.id}: ${(r.reason as Error).message}`);
      }
    }

    if (processed > 0 && processed % FLUSH_EVERY < BATCH_SIZE) {
      saveCache(cache);
      const cost = (totalIn / 1e6) * PRICE_INPUT_PER_MTOK + (totalOut / 1e6) * PRICE_OUTPUT_PER_MTOK;
      const pct = ((processed / todo.length) * 100).toFixed(1);
      console.log(`  💾 ${processed}/${todo.length} (${pct}%) — running cost $${cost.toFixed(4)}`);
    }
  }

  // Final flush
  saveCache(cache);

  const cost = (totalIn / 1e6) * PRICE_INPUT_PER_MTOK + (totalOut / 1e6) * PRICE_OUTPUT_PER_MTOK;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n────────────────────────────────────────");
  console.log(`✅ Extraction complete`);
  console.log(`   Deals processed:  ${processed}/${todo.length}`);
  console.log(`   Tokens (in/out):  ${totalIn.toLocaleString()} / ${totalOut.toLocaleString()}`);
  console.log(`   Cost:             $${cost.toFixed(4)}`);
  console.log(`   Time:             ${elapsed}s`);
  console.log(`   Output:           ${OUT_PATH}`);
  console.log(`────────────────────────────────────────`);

  // Append to cost log
  appendCostLog(totalIn, totalOut, cost, processed);

  // Quick quality summary
  const all = Object.values(cache);
  const high = all.filter((e) => e.confidence === "high").length;
  const med  = all.filter((e) => e.confidence === "medium").length;
  const low  = all.filter((e) => e.confidence === "low").length;
  const accessories = all.filter((e) => e.is_accessory).length;
  const branded = all.filter((e) => e.brand).length;
  console.log(`\n📈 Quality summary (full cache):`);
  console.log(`   Total entries:    ${all.length}`);
  console.log(`   Branded:          ${branded} (${((branded / all.length) * 100).toFixed(1)}%)`);
  console.log(`   Confidence:       high=${high} medium=${med} low=${low}`);
  console.log(`   Accessories:      ${accessories}`);
  console.log(`\nNext: run validate-extraction.ts to check golden queries.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
