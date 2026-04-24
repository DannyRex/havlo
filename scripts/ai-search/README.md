# scripts/ai-search/ — Quick Reference

> Don't run anything in here without first reading
> `docs/ai-search/RESUME.md` and finding the next unchecked step.

## TL;DR

```bash
# Phase 0 — Setup (one time)
export ANTHROPIC_API_KEY=sk-ant-...
npm install @anthropic-ai/sdk

# Phase 0 — Capture baseline
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/baseline-search.ts

# Phase 1 — Run extraction (~$0.30, ~5 min)
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/extract-products.ts

# Phase 1 — Validate
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/validate-extraction.ts

# Phase 1 — Wire into the search engine
npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/replace-signature.ts
npm run lint && npm run build

# Phase 2 — Vector search (NOT YET IMPLEMENTED — see stubs)
# npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts --text
# npx tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts --images
```

## Optional npm scripts

Add these to `package.json` for convenience:

```json
"scripts": {
  "ai:baseline":  "tsx --tsconfig tsconfig.scripts.json scripts/ai-search/baseline-search.ts",
  "ai:extract":   "tsx --tsconfig tsconfig.scripts.json scripts/ai-search/extract-products.ts",
  "ai:validate":  "tsx --tsconfig tsconfig.scripts.json scripts/ai-search/validate-extraction.ts",
  "ai:wire":      "tsx --tsconfig tsconfig.scripts.json scripts/ai-search/replace-signature.ts",
  "ai:embed":     "tsx --tsconfig tsconfig.scripts.json scripts/ai-search/embed-deals.ts"
}
```

Then: `npm run ai:extract`, `npm run ai:validate`, etc.

## Files in this directory

| File | Status | Purpose |
|---|---|---|
| `baseline-search.ts` | ✅ runnable | Snapshot current heuristic results for golden queries |
| `extract-products.ts` | ✅ runnable | Phase 1: Haiku → extracted.json |
| `validate-extraction.ts` | ✅ runnable | Phase 1: regression check |
| `replace-signature.ts` | ✅ runnable | Phase 1: in-place wire-up |
| `supabase-schema.sql` | ✅ ready | Phase 2: DDL (run in Supabase SQL editor) |
| `embed-deals.ts` | 🚧 stub | Phase 2: TODO list at top of file |
| `vector-search.ts` | 🚧 stub | Phase 2: TODO list at top of file |

## Troubleshooting

**"ANTHROPIC_API_KEY not set"**
→ `export ANTHROPIC_API_KEY=sk-ant-...` then re-run.

**Extraction is slow / hitting rate limits**
→ Lower `BATCH_SIZE` in `extract-products.ts` from 20 to 5–10.

**Validation says quality bar not met**
→ Open `data/ai-search/validation-report.json`, look at `details[].reasons`,
identify failing patterns. Tune the system prompt in
`docs/ai-search/PROMPTS.md`, bump version to `extract-v2`, re-run extraction.

**Build fails after `replace-signature.ts`**
→ Restore backups:
```bash
mv src/lib/search/normalize.ts.pre-ai.bak src/lib/search/normalize.ts
mv src/lib/search/index.ts.pre-ai.bak     src/lib/search/index.ts
```
Then file an issue under `ROADMAP.md` §1.3 and ping the next session.
