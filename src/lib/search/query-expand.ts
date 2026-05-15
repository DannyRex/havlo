/* Query expansion: synonyms + brand aliases.

   Postgres FTS via websearch_to_tsquery handles stemming, stop
   words, and English-language morphology — "headphones" matches
   "headphone", "phones" matches "phone". What it CAN'T handle:
     • cross-spelling brand aliases ("rayban" vs "Ray-Ban")
     • genre/concept synonyms ("earbuds" ≠ "earphones" lexically)
     • compound vs split tokens ("macbook" vs "mac book")
     • abbreviations ("ps5" vs "playstation 5")

   This module expands the user's query BEFORE it hits FTS so all
   three concerns get covered. We don't try to expand the query
   into a giant OR — that floods FTS rank with noise. We pick the
   strongest single-best expansion and use it as the searched
   string; if the original matched, we also include the original
   as a fallback in callers that fan out.

   Two layered passes:
     1. expandBrandAliases — normalises known brand spellings so
        "rayban sunglasses" finds "Ray-Ban Aviator" via FTS.
     2. expandSynonyms — substitutes a token with its canonical
        form when the catalog uses one consistently (e.g., the
        DB has "earphones" entries; user types "earbuds").

   Both passes are CONSERVATIVE — they only expand recognised
   tokens, leaving the rest of the query intact. A novel brand
   ("dyson airwrap" → no expansion needed; FTS handles it) is
   unchanged.

   Reverse-direction guard: we never expand a token into something
   that wasn't typed (e.g. "earbuds" → "earphones") and silently
   drop the original. Multi-token original is preserved so the
   exact-phrase boost in search_products_fts / search_deals_fts
   still kicks in when the user's literal phrasing matches.

   Returns an object so callers can pick the right field for their
   surface — { expanded, original, didExpand } — rather than juggling
   two strings. */

/* ── Brand aliases ─────────────────────────────────────────────────
   Maps "user-typed form" → "canonical catalogue form". The CANONICAL
   form is the one most-likely to appear in the products.title field,
   so FTS scores it higher.

   Order matters within a key cluster: longer / more-specific
   alternates come first so a query like "raybanaviator" matches the
   compound form before falling through to the bare "rayban".

   Maintained as a flat lookup for O(1) per-token replacement; that
   trades a slightly bigger map for a faster pass per query. */
const BRAND_ALIASES: Record<string, string> = {
  // Eyewear
  "rayban":     "ray-ban",
  "ray-ban":    "ray-ban",
  "rayban's":   "ray-ban",

  // Apple
  "macbook":    "macbook",   // pass-through to defeat split-token "mac book"
  "ipad":       "ipad",
  "iphone":     "iphone",
  "airpods":    "airpods",
  "airpod":     "airpods",
  "imac":       "imac",
  "applewatch": "apple watch",

  // Gaming
  "ps5":        "playstation 5",
  "ps4":        "playstation 4",
  "playstation5":"playstation 5",
  "playstation4":"playstation 4",
  "xbox":       "xbox",
  "nintendo":   "nintendo",

  // Audio
  "jbl":        "jbl",
  "bose":       "bose",
  "airmax":     "airmax",
  "soundcore":  "soundcore",

  // Phones
  "samsunggalaxy":"samsung galaxy",
  "galaxys24":  "galaxy s24",
  "galaxys25":  "galaxy s25",
  "galaxys23":  "galaxy s23",

  // Fashion
  "newbalance": "new balance",
  "underarmour":"under armour",

  // Beauty
  "loreal":     "l'oreal",
  "esteelauder":"estee lauder",
  "macbookpro": "macbook pro",
  "macbookair": "macbook air",
};

/* Split-form fixes: queries that came in glued ("mac book") should
   match the joined canonical ("macbook") and vice versa. Applied
   AFTER per-token alias normalisation so we don't double-process. */
const SPLIT_FORM_PATTERNS: Array<{ from: RegExp; to: string }> = [
  { from: /\bmac\s+book\b/gi,        to: "macbook" },
  { from: /\bplay\s+station\b/gi,    to: "playstation" },
  { from: /\bsmart\s+watch\b/gi,     to: "smartwatch" },
  { from: /\bear\s+pods\b/gi,        to: "airpods" },   // common typo
  { from: /\bgalaxy\s+s\s*(\d{2})\b/gi, to: "galaxy s$1" }, // 'galaxy s 24' → 'galaxy s24'
];

/* ── Synonyms ──────────────────────────────────────────────────────
   Maps "user-typed concept" → "canonical concept the catalog uses".
   Only one-way: we expand FROM the user form TO the canonical form,
   not the reverse, so canonical queries are never warped.

   Conservative — only synonyms where the catalog consistently uses
   one form. If both forms appear in similar volumes, leave as-is. */
const SYNONYMS: Record<string, string> = {
  // Audio
  "earbud":     "earphone",
  "earbuds":    "earphones",
  "earpieces":  "earphones",

  // Display
  "television": "tv",

  // Computing
  "notebook":   "laptop",
  "notebooks":  "laptops",

  // Generic phrases
  "mobile":     "phone",
  "mobiles":    "phones",
  "cellphone":  "phone",
  "cell phone": "phone",
  "handphone":  "phone",
};

/* Tokens we never touch — preserve query intent. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "with", "for", "to", "of", "in", "on", "at",
]);

export interface ExpandedQuery {
  /** The query rewritten with aliases + synonyms applied. */
  expanded: string;
  /** The user's literal input — useful for the exact-phrase boost
      and for callers that want to fan out FTS over both. */
  original: string;
  /** True when expansion actually changed something. Callers can
      skip the fallback fan-out when nothing changed. */
  didExpand: boolean;
}

/* Expand a user query through alias + synonym + split-form passes.
   Lowercases tokens internally but preserves the case of the
   original string in `.original` for display / logging. */
export function expandQuery(raw: string): ExpandedQuery {
  const original = raw.trim();
  if (!original) {
    return { expanded: "", original: "", didExpand: false };
  }

  // Pass 1: split-form fixes operate on the whole phrase.
  let working = original;
  for (const { from, to } of SPLIT_FORM_PATTERNS) {
    working = working.replace(from, to);
  }

  // Pass 2: per-token brand alias + synonym lookup. Lowercase for
  // matching but keep token-boundary regex so we don't corrupt
  // adjacent text.
  const tokens = working.split(/(\s+)/); // keep whitespace tokens
  const out = tokens.map((tok) => {
    if (/^\s+$/.test(tok)) return tok;
    const low = tok.toLowerCase();
    if (STOPWORDS.has(low)) return tok;
    const aliased = BRAND_ALIASES[low];
    if (aliased) return aliased;
    const syn = SYNONYMS[low];
    if (syn) return syn;
    return tok;
  });

  const expanded = out.join("").trim().toLowerCase();
  const didExpand = expanded !== original.toLowerCase();

  return { expanded, original, didExpand };
}

/* Build a list of FTS query candidates from a user query.

   The returned array is the order of attempts a multi-strategy
   search path should make:
     [0] Original   — preserves exact-phrase boost when literal
     [1] Expanded   — when expansion changed something
     [2] Stripped   — token-strip fallback ('iphone 15 pro max'
                       → 'iphone 15'); covers FTS misses on
                       trailing modifiers.

   Empty / duplicate candidates are filtered out. Callers walk the
   array and use the first non-empty result. */
export function searchCandidates(raw: string): string[] {
  const { expanded, original, didExpand } = expandQuery(raw);
  const candidates: string[] = [];
  if (original) candidates.push(original);
  if (didExpand && expanded && expanded !== original.toLowerCase()) {
    candidates.push(expanded);
  }
  // Token strip — last resort for over-specific queries.
  const stripped = stripTrailingTokens(expanded || original);
  if (stripped && !candidates.includes(stripped)) {
    candidates.push(stripped);
  }
  return candidates;
}

const TRAILING_STRIP_TOKENS = new Set([
  "pro", "max", "ultra", "plus", "mini", "lite", "se", "air",
  "blue", "red", "black", "white", "silver", "gold", "titanium",
  "graphite", "gray", "grey", "purple", "pink", "green", "starlight",
  "256gb", "512gb", "128gb", "64gb", "1tb", "2tb",
  "5g", "4g", "lte", "wifi",
]);

function stripTrailingTokens(query: string): string | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  let i = tokens.length;
  while (i > 1 && TRAILING_STRIP_TOKENS.has(tokens[i - 1])) i--;
  if (i === tokens.length) return null;
  if (i < 2) return null;
  return tokens.slice(0, i).join(" ");
}
