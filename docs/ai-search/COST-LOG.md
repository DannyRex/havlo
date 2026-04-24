# COST LOG — Append-Only Spend Record

> Every script that calls a paid API appends a row here. Don't edit past
> entries. Roll up at the bottom for quick review.

| Date | Phase | Operation | Provider | Model | Tokens In | Tokens Out | Images | Cost USD | Notes |
|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  | First run pending |
| 2026-04-23 | 1 | extract-products (571 deals) | Anthropic | claude-haiku-4-5 | 858284 | 92840 | — | $1.3225 | prompt=extract-v1 |
| 2026-04-23 | 1 | extract-products (596 deals) | Anthropic | claude-haiku-4-5 | 896795 | 97003 | — | $1.3818 | prompt=extract-v1 |
| 2026-04-24 | 2 | embed-deals --text (1167 deals) | — | — | — | — | — | $0.0006 | model=text-embedding-3-small tokens=29802 |
| 2026-04-24 | 2 | embed-deals --text (167 deals) | — | — | — | — | — | $0.0001 | model=text-embedding-3-small tokens=3373 |
| 2026-04-24 | 2 | embed-deals --images (0 deals) | — | — | — | — | — | $0.0000 | model=embed-v4.0 |
| 2026-04-24 | 2 | embed-deals --images (1116 deals) | — | — | — | — | — | $0.1116 | model=embed-v4.0 |

## Rolling totals

- **All-time total:** $2.7043 (extraction complete — 1167/1167 deals)
- **Last 30 days:** $2.7043
- **This month:** $2.7043

(These are updated manually after each run. Future: auto-roll-up via the
weekly cron job in Phase 3.)
