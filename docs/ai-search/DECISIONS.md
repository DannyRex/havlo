# DECISIONS — Architectural Choices (Locked In)

> Each decision here was made deliberately. Don't second-guess them in a future
> session without strong evidence — write a new ADR-style entry below if you do.

---

## D1 — Why LLM extraction at index time, not query time

**Decision:** Run Haiku 4.5 once per deal at scrape time. Cache results in
`extracted.json`. Query path stays pure-code.

**Why:**
- Per-query LLM calls would 100× the bill ($0.30 total → $30/day at 1k searches).
- Latency: a query needs to return in <200 ms; LLM calls add 500–2000 ms.
- Determinism: same query always produces the same result.
- Caching by content hash means we only re-pay when a deal title changes.

**Trade-off:** Adds a build-step dependency. New deals from a fresh scrape
must be extracted before they appear in search. Mitigation: the existing
heuristic extractor in `normalize.ts` is kept as a fallback so unprocessed
deals still match (just less accurately).

---

## D2 — Why Haiku 4.5 (not Sonnet, not Opus, not GPT-4o)

**Decision:** Anthropic Claude Haiku 4.5 for extraction.

**Why:**
- Task is "pull brand/model/storage out of a product title" — a classification
  task that small models nail. Sonnet/Opus would be 5–20× more expensive for
  marginal quality gains on this specific task.
- Haiku 4.5 is JSON-mode reliable.
- Already on the user's Anthropic account (one less vendor).
- Speed: ~150 tokens/sec → 1,167 deals fit in <5 minutes.

**Reconsider if:** validation accuracy on golden queries falls below 85%.
Try Sonnet 4.5 for a sample of failing extractions before adding another vendor.

---

## D3 — Why pgvector (Supabase) for vectors, not Pinecone/Qdrant

**Decision:** Supabase Postgres + pgvector.

**Why:**
- Free tier handles 10k–100k vectors, well above current catalog of 1,167.
- One database for both deals metadata + vectors → no two-system consistency problem.
- HNSW indexes in pgvector are within 10% of Pinecone latency at this scale.
- Supabase has a generous free tier and predictable $25/month upgrade.
- No cold-start penalty (vs. serverless vector DBs that spin up per request).

**Reconsider if:** catalog grows past ~250k rows OR query p99 > 200ms.
Then evaluate Turbopuffer (cheap at scale) or Qdrant Cloud.

---

## D4 — Why text + image embeddings, not text-only

**Decision:** Both text (OpenAI `text-embedding-3-small`, 1536 dim) AND image
(Cohere multimodal v3, 1024 dim) embeddings per deal.

**Why text:** Catches semantic similarity ("airpods" ≈ "wireless earbuds").
**Why image:** This is the Dupe.com magic — a $4k sofa and a $400 sofa share
no text tokens but their photos are similar. For URL-paste flow this is the
PRIMARY signal.

**Cost:** ~$0.05 (text) + ~$10 (image) one-time. Re-embed only on URL change.

**Reconsider if:** image embedding budget becomes a constraint at scale.
Drop image embeddings and rely on text + structured filters. The "find dupes
from a URL" feature degrades but doesn't disappear.

---

## D5 — Why hybrid (vectors + structured filters), not pure ANN

**Decision:** Vector search retrieves top-200 candidates; structured filters
(brand, storage, inches, accessory, category) prune to the final result set.

**Why:** Embeddings are great at semantic recall but smooth over things you
WANT to be hard rules:
- 64 GB ≠ 256 GB (price varies massively)
- 43" TV ≠ 65" TV (different products entirely)
- Phone case ≠ phone (vector says "very similar"; user says "not what I asked")

The current heuristic engine has these filters. We KEEP them, just feed them a
much better candidate set.

---

## D6 — Why keep `src/lib/search/normalize.ts` as a fallback

**Decision:** Don't delete the heuristic path immediately after Phase 1 lands.

**Why:**
- New deals added between scrapes haven't been LLM-extracted yet.
- Provides a graceful degradation path if Anthropic API has an outage.
- Lets us A/B compare matching quality during rollout.

**When to delete:** After Phase 3 ships AND we've had 2 weeks of clean
production telemetry showing the AI path is strictly better.

---

## D7 — Why the public API contract doesn't change

**Decision:** `SearchOutput`, `ProductGroup`, `StoreOffer` types stay
exactly as defined in `src/lib/search/index.ts` today. Both Phase 1 and
Phase 2 must conform.

**Why:** The frontend (`/compare/page.tsx`, `PriceResults.tsx`, `DupeCard.tsx`)
is intentionally decoupled from the search internals. Changing the contract
means coordinating UI changes with engine changes — too much risk.

**Implication:** The vector search layer must do its own grouping after ANN
retrieval to produce `ProductGroup`s. Slightly more code; much safer rollout.

---

## D8 — Why `data/ai-search/extracted.json` is committed to git (for now)

**Decision:** Check in `extracted.json` as part of the Phase 1 PR.

**Why:**
- Catalog is small (~1,167 deals → ~500 KB JSON).
- Makes the build hermetic — no network dependency at deploy time.
- Lets reviewers see the actual extracted data and spot bad rows.
- `scrape.ts` will regenerate it on each scrape and re-commit (as it does
  today with `deals.ts`).

**Reconsider when:** catalog passes ~10k deals or file passes ~5 MB. At that
point move to Supabase as the source of truth and gitignore the JSON.

---

## Cost (locked-in expectations)

| Item | One-time | Monthly |
|---|---|---|
| Phase 1 extraction (1,167 deals) | $0.30 | $0.50 (assuming ~50 new deals/day) |
| Phase 2 text embeddings | $0.05 | $0.10 |
| Phase 2 image embeddings | $10 | $1 (only on image-changed deals) |
| Per-search vector + rerank | — | $5–15 (at 1k searches/day) |
| Supabase | — | $0 (free tier) → $25 (pro tier when needed) |
| **TOTAL** | **~$11** | **~$7–42/month** |

If monthly cost exceeds $50 without traffic exceeding 10k searches/day,
something is misconfigured (likely re-embedding on every scrape instead of
diffing).

---

## Future ADRs go below

Add new entries with format: `## D<N> — <Title>` plus Decision/Why/Trade-off.
