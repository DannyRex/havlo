# ROADMAP — Step-by-Step Implementation

> Each step is **atomic, verifiable, and reversible**. Run the command, check
> the verification, tick the box in `RESUME.md`. If verification fails, do not
> proceed — record the issue under the step.

---

## Phase 0 — Setup (15 minutes)
> 🤖 **Model: `claude-sonnet-4-6`** — run `/model claude-sonnet-4-6` before starting this phase.

### 0.1 — Anthropic API key

**What:** Get an API key from https://console.anthropic.com → API Keys → Create.

**Setup:**
```bash
# Add to ~/.zshrc OR a project .env.local (gitignored)
export ANTHROPIC_API_KEY="sk-ant-..."
```

Set a $20/month spending limit on the Anthropic console as a guardrail.

**Verify:**
```bash
echo "${ANTHROPIC_API_KEY:0:10}..."   # should print "sk-ant-..." prefix
```

### 0.2 — Install Anthropic SDK

```bash
cd /Users/admin/Dealesty
npm install @anthropic-ai/sdk
```

**Verify:**
```bash
node -e "console.log(require('@anthropic-ai/sdk').default ? 'ok' : 'fail')"
```

### 0.3 — Review golden queries

Open `data/ai-search/golden-queries.json` and add 5–10 of YOUR real-world test
queries. The seed set has ~20 cases; yours should reflect actual user intent.
Each query has the form:

```json
{
  "query": "Galaxy A06 128GB",
  "expect": { "mode": "single", "brand": "samsung", "model_contains": "a06" },
  "notes": "Should bucket all storage variants together"
}
```

**Verify:** File parses as valid JSON and has ≥25 entries:
```bash
jq 'length' data/ai-search/golden-queries.json
```

### 0.4 — Capture baseline

Snapshot what the current heuristic engine returns for each golden query so we
can quantitatively compare Phase 1 against today.

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/baseline-search.ts
```

**Verify:** `data/ai-search/baseline.json` exists with one entry per query, each
recording `{topResultTitle, mode, score, storeCount}`.

---

## Phase 1 — LLM Extraction (1–2 hours of work, ~1 hour of API time)
> 🤖 **Model: `claude-sonnet-4-6`** for steps 1.1–1.6.
> ⚠️  **Exception:** if validation (step 1.2) fails with pass rate <80%, switch to `claude-opus-4-7` to tune the prompt in `PROMPTS.md`, then switch back to Sonnet once validation passes.

### 1.1 — Run extraction

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/extract-products.ts
```

What this does:
- Reads `src/lib/data/deals.ts`
- Hashes each deal's `title + description`
- Skips any hash already present in `data/ai-search/extracted.json`
- Calls Haiku 4.5 in batches of 20 with the prompt from `PROMPTS.md` §extract-v1
- Writes incrementally — safe to Ctrl-C and resume
- Logs total cost to `docs/ai-search/COST-LOG.md`

**Expected runtime:** ~3–5 minutes for 1,167 deals.
**Expected cost:** ~$0.30 (Haiku 4.5: ~$1/MTok input, ~$5/MTok output, ~250 tokens/deal).

**Verify:**
```bash
node -e "const e = require('./data/ai-search/extracted.json'); console.log('entries:', Object.keys(e).length)"
# Should print >= 1100
```

### 1.2 — Validate against golden queries

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/validate-extraction.ts
```

What this does:
- For each query in `golden-queries.json`, runs both:
  - The current heuristic matcher (from `baseline.json`)
  - A new matcher using `extracted.json` (instead of `buildSignature`)
- Reports per-query: `pass`, `regress`, `improve`, `unchanged`
- Fails the run with non-zero exit if regressions outnumber improvements

**Acceptance criteria:** ≥80% of queries pass, regressions ≤2.
If you fail this, **do not proceed**. Either tune the prompt (`PROMPTS.md`) and
re-run extraction for the failing deals, or add the failing query as an
`exceptions` entry with a justification.

### 1.3 — Wire into normalize.ts

Run the in-place swap script:

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/replace-signature.ts
```

What this does:
- Backs up `src/lib/search/normalize.ts` to `normalize.ts.pre-ai.bak`
- Adds an `extractedSignature(dealId)` function that reads from `extracted.json`
- Modifies `buildSignature` to prefer extracted data when a `dealId` is supplied,
  falling back to the existing regex extraction otherwise
- Touches `src/lib/search/index.ts` to pass `dealId` through `getIndex()`

**Verify:**
```bash
npm run lint
npm run build
```

Both must pass with no new errors. If either fails, restore the backup:
```bash
mv src/lib/search/normalize.ts.pre-ai.bak src/lib/search/normalize.ts
git checkout src/lib/search/index.ts
```

### 1.4 — Manual smoke test

Start the dev server and spot-check 5 queries on `/compare`:

```bash
npm run dev
# Open http://localhost:3000/compare and try:
#   "iPhone 15 Pro Max"
#   "Galaxy A06"
#   "Hisense 50 inch TV"
#   "AirPods"
#   <one query you know used to fail>
```

Each should return at least the same quality as before, ideally better
(more variants grouped together, less accessory noise).

### 1.5 — Commit Phase 1

```bash
git add docs/ai-search scripts/ai-search data/ai-search src/lib/search
git commit -m "Phase 1: LLM-extracted product signatures

Replaces regex-based brand/model extraction with Haiku-extracted JSON
cached in data/ai-search/extracted.json. Heuristic path kept as fallback
for any deal not in the cache.

Validation: $(jq '.summary' data/ai-search/validation-report.json)
Cost: see docs/ai-search/COST-LOG.md"
```

Then update `RESUME.md` — tick boxes 1.1 through 1.6.

---

## Phase 2 — Vector Search (3–5 days of work)
> 🤖 **Model: `claude-sonnet-4-6`** for steps 2.1–2.4 and 2.6–2.8.
> ⚠️  **Switch to `claude-opus-4-7` at step 2.5** (implementing `vector.ts`) — this is the ranking logic that determines dupe quality. Switch back to Sonnet when 2.5 is committed.

> ⚠️ Phase 2 is OPTIONAL. Phase 1 alone gives you ~70% of the quality win at
> ~5% of the work. Only proceed if Phase 1 results are landed and you've
> decided visual/semantic dupes are worth the additional infrastructure.

### 2.1 — Supabase setup

1. Create project at https://supabase.com (free tier is fine).
2. Add env vars to `.env.local`:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   OPENAI_API_KEY=sk-...        # for text embeddings (cheaper than Voyage to start)
   COHERE_API_KEY=...           # OPTIONAL, only if doing image embeddings
   ```
3. Install clients:
   ```bash
   npm install @supabase/supabase-js openai
   # If image embeddings: npm install cohere-ai
   ```

**Verify:**
```bash
node -e "const { createClient } = require('@supabase/supabase-js'); createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY).from('_').select().then(()=>console.log('ok')).catch(e=>console.log('reachable:', e.message))"
```

### 2.2 — Apply schema

In the Supabase SQL editor, paste & run `scripts/ai-search/supabase-schema.sql`.
This creates the `deals_index` table with `vector(1536)` for text and
`vector(1024)` for image embeddings, plus an HNSW index on each.

**Verify:**
```sql
select count(*) from deals_index;   -- 0
\d+ deals_index                      -- columns + indexes present
```

### 2.3 — Text embeddings

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts --text
```

**Expected runtime:** ~2 minutes. **Expected cost:** ~$0.05.

### 2.4 — Image embeddings (OPTIONAL)

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts --images
```

**Expected runtime:** ~10 minutes (rate-limited by Cohere).
**Expected cost:** ~$10 for 1,167 product images.

### 2.5 — Implement vector search

The file `src/lib/search/vector.ts` is a stub with full type signatures and
TODOs. Fill it in following the spec at the top of the file. Key contract:

```ts
export async function vectorSearch(query: string): Promise<SearchOutput>
export async function vectorSearchByImage(imageUrl: string): Promise<SearchOutput>
```

These must return the SAME `SearchOutput` shape as the current `search()` so
the frontend doesn't change.

### 2.6 — Swap the API route

Modify `src/app/api/compare/route.ts` to call `vectorSearch` instead of
`search`. Keep a feature flag:

```ts
const USE_VECTOR = process.env.USE_VECTOR_SEARCH === "true";
const result = USE_VECTOR ? await vectorSearch(q) : search(q);
```

This lets you A/B compare in production by toggling the env var.

### 2.7 — Re-validate

```bash
USE_VECTOR_SEARCH=true npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/validate-extraction.ts
```

Quality MUST be ≥ Phase 1. If not, the vector layer is misconfigured — do not
ship. Common issues: wrong embedding model dimension, missing HNSW index,
filter applied before ANN instead of after.

### 2.8 — Commit Phase 2

```bash
git commit -m "Phase 2: Vector + image search for cross-brand dupes"
```

---

## Phase 3 — Cleanup & Telemetry (1–2 days)
> 🤖 **Model: `claude-sonnet-4-6`** — mechanical cleanup, no Opus needed.

### 3.1 — Delete dead heuristics

After Phase 2 is in production for ≥2 weeks with no quality complaints, remove:
- `MODEL_HINTS`, `PRODUCT_TYPES`, `CATEGORY_KEYWORDS`, `GENERIC_MODEL_NOISE`,
  `BRANDS`, `BRAND_ALIAS` from `src/lib/search/normalize.ts`
- `scoreGroup`, `dupeSimilarity` from `src/lib/search/index.ts` (replaced by
  vector + filter)
- The `_index`/`_groups` in-memory caches (replaced by Supabase)

Keep: `tokensOf`, `stripPunct`, `STOP` (still useful for query preprocessing).

### 3.2 — Click telemetry

Add `POST /api/click` that records `{deal_id, query, position, clicked_at}`.
Store in Supabase `clicks` table. The frontend logs this on each offer-link
click in `PriceResults.tsx` and `DupeCard.tsx`.

### 3.3 — Weekly re-rank

Cron job (Vercel cron or GitHub Actions) that, weekly:
1. Aggregates clicks per `(category, brand)` over the last 30 days
2. Computes a `popularity_score` per `deals_index` row
3. Updates a `popularity_score` column used as a tiebreaker in `vectorSearch`

### 3.4 — Cost dashboard

Add a `## AI search cost` section to `README.md` showing rolling 30-day spend
from `COST-LOG.md`. Optional: auto-update via the cron job in 3.3.

---

## Rollback playbook

If anything breaks in production after a phase ships:

**Phase 1 rollback:**
```bash
mv src/lib/search/normalize.ts.pre-ai.bak src/lib/search/normalize.ts
git revert <phase-1-commit>
```

**Phase 2 rollback:** Set `USE_VECTOR_SEARCH=false` in Vercel env vars. The
heuristic path is still live until Phase 3 deletes it.

**Nuclear option:** Delete the `data/ai-search/` and `docs/ai-search/`
directories and `git revert` all four PRs. The original `src/lib/search/`
is unchanged in the first 1.x commits — you'll be back to the pre-AI state.
