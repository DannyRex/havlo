/* "Same line, other configuration" selector for the PDP's
   "Other configurations" disclosure (#15).

   DISPLAY-ONLY: the products this returns never merge into the price
   comparison/spectrum — they just link out to each config's own PDP.
   Because no number here feeds the anchor's comparison, the rule can be
   generous without risking a "numbers contradict" mismatch.

   A candidate is an "other configuration" of the anchor iff its parsed
   model shares the anchor's LINE identity — the first two tokens of the
   anchor's model (e.g. "macbook air", "iphone 15", "galaxy s24") — on a
   word boundary, so "iphone 15" doesn't prefix-match "iphone 159". When
   both sides carry a brand we also require it to match (cheap guard
   against a hypothetical cross-brand model-token collision); a missing
   brand on either side is not allowed to exclude a candidate, since the
   line token is already brand-specific in practice.

   Empirically tuned against live data (read-only smoke test, June 2026):
     MacBook Air 15 M3  → MacBook Air 13 / Air M4  ✓  (both Pro excluded)
     iPhone 15          → iPhone 15 Plus           ✓  (14 / 16 / SE excluded)
     Galaxy S24         → none (pool was S26 + budget A-series) ✓ */

import { buildSignature } from "./normalize";
import type { DupeResult } from "./index";

/** First two tokens of a title's parsed model — the "line" identity. */
export function lineTokens(title: string): string {
  const model = buildSignature(title).model;
  if (!model) return "";
  return model.split(/\s+/).slice(0, 2).join(" ").trim();
}

export function selectLineConfigs(
  anchor: { title: string; brand: string | null },
  candidates: DupeResult[],
): DupeResult[] {
  const line = lineTokens(anchor.title);
  if (line.length === 0) return [];
  const anchorBrand = anchor.brand ? anchor.brand.toLowerCase() : null;

  const seen = new Set<string>();
  const out: DupeResult[] = [];
  for (const d of candidates) {
    if (seen.has(d.key)) continue;
    /* Positive brand-mismatch guard only — never drop a null-brand
       candidate, since the line token already carries brand identity. */
    const candBrand = d.brand ? d.brand.toLowerCase() : null;
    if (anchorBrand && candBrand && anchorBrand !== candBrand) continue;

    const m = buildSignature(d.title).model;
    if (!m) continue;
    if (m === line || m.startsWith(line + " ")) {
      seen.add(d.key);
      out.push(d);
    }
  }
  return out;
}
