/**
 * Phase 2 — Vector search query layer (replaces scoreGroup + dupeSimilarity).
 *
 * ⚠️  STUB — NOT YET IMPLEMENTED.
 * This is a spec for the eventual src/lib/search/vector.ts module.
 *
 * Contract (must match src/lib/search/index.ts public API exactly — see D7):
 *
 *   export async function vectorSearch(query: string, opts?): Promise<SearchOutput>
 *   export async function vectorSearchByImage(imageUrl: string): Promise<SearchOutput>
 *
 * Behavior:
 *   1. Embed the query (OpenAI text-embedding-3-small, 1536d) — ~5ms
 *   2. ANN search top-200 candidates from Supabase deals_index (HNSW) — ~10ms
 *   3. Apply structured filters (brand, storage, inches, accessory penalty) — instant
 *   4. Group by (brand, model, inches) — same logic as today's getGroups()
 *   5. Decide single/list mode using the same querySpecific + dominates rules
 *   6. Return SearchOutput
 *
 * For findSimilar (cross-brand dupes):
 *   1. Identify anchor (vectorSearch top-1)
 *   2. ANN over IMAGE embeddings of anchor against all other deals (visual similarity)
 *   3. Filter: same category, different brand OR cheaper price
 *   4. Score = 0.5 * imageSim + 0.3 * textSim + 0.2 * structuredScore
 *   5. Return DupeResult[]
 */

// ─── TODO for future session ────────────────────────────────────────────────
// 1. Implement vectorSearch(query) end-to-end
// 2. Implement vectorSearchByImage(imageUrl)
//      - For URL paste: scrape the image, embed it (Cohere multimodal)
//      - For internal anchor: just look up its image_emb from Supabase
// 3. Add a feature flag in src/app/api/compare/route.ts:
//      const USE_VECTOR = process.env.USE_VECTOR_SEARCH === "true";
//      const result = USE_VECTOR ? await vectorSearch(q) : search(q);
// 4. Re-run scripts/ai-search/validate-extraction.ts with USE_VECTOR_SEARCH=true
//    The shadow matcher in that script will need a parallel "vector shadow"
//    that calls vectorSearch directly. Add it as a -—vector flag.
// 5. Move the implementation to src/lib/search/vector.ts when validated

console.error(`This script is a spec stub. See ROADMAP.md §2.5 and the TODO above.`);
process.exit(2);
