# PROMPTS — Versioned LLM Prompts

> All prompts used in the AI search pipeline live here. Each prompt has a
> version (e.g. `extract-v1`). Bumping the version means re-running extraction
> on the WHOLE catalog (cache key includes prompt version).

---

## extract-v1 — Product structured-data extraction

**Used by:** `scripts/ai-search/extract-products.ts`
**Model:** `claude-haiku-4-5`
**Mode:** JSON output via tool call (forces schema compliance)
**Cache key:** `sha256(promptVersion + title + description)`

### System prompt

```
You are a product-data extraction engine for a Nigerian price-comparison site.
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
- "inches" is a number (TVs: integer 19–120; phones/tablets: float like 6.5).
- "color" is the primary color, lowercased single word ("black", "rosegold").
- "is_accessory" is true for cases, cables, chargers, screen protectors,
  remotes, holders, replacement parts. False for the actual device.
- "search_terms" is a clean, normalized phrase a shopper would actually type
  to find THIS product (e.g. "samsung galaxy a06 128gb"). 2–6 words. Lowercase.
```

### Tool schema

```json
{
  "name": "extract_product",
  "description": "Extract structured fields from a product listing",
  "input_schema": {
    "type": "object",
    "properties": {
      "brand": { "type": ["string", "null"] },
      "model": { "type": ["string", "null"] },
      "variant": { "type": ["string", "null"] },
      "product_type": {
        "type": ["string", "null"],
        "enum": [
          "flagship-phone", "budget-phone", "tablet",
          "premium-laptop", "laptop", "desktop", "monitor",
          "premium-earbuds", "earbuds", "headphones", "speaker", "soundbar",
          "tv", "console", "smartwatch", "camera",
          "fridge", "washer", "ac", "microwave", "fan", "blender",
          "sneakers", "dress", "outerwear", "tops", "bottoms", "bags", "watch",
          "skincare", "haircare", "fragrance", "makeup",
          "accessory", "other", null
        ]
      },
      "storage_gb": { "type": ["integer", "null"], "minimum": 1, "maximum": 4096 },
      "ram_gb": { "type": ["integer", "null"], "minimum": 1, "maximum": 256 },
      "inches": { "type": ["number", "null"], "minimum": 0.5, "maximum": 200 },
      "color": { "type": ["string", "null"] },
      "is_accessory": { "type": "boolean" },
      "confidence": {
        "type": "string",
        "enum": ["high", "medium", "low"],
        "description": "Your confidence that brand+model are correct"
      },
      "search_terms": { "type": "string", "minLength": 2, "maxLength": 60 }
    },
    "required": ["is_accessory", "confidence", "search_terms"]
  }
}
```

### User message template

```
Title: {{title}}
Description: {{description}}
Category: {{category}}
Store: {{storeName}}

Extract the structured fields.
```

### Examples (few-shot — included in user message for tricky cases)

These help the model handle ambiguous Nigerian-market listings.

**Example 1 — phone with multiple storage variants in title**
```
Title: Samsung Galaxy A06 64GB+4GB & 128GB+4GB - Black
Category: Phones & Tablets
→ {
  "brand": "samsung", "model": "galaxy a06", "variant": null,
  "product_type": "budget-phone", "storage_gb": 128, "ram_gb": 4,
  "color": "black", "is_accessory": false, "confidence": "high",
  "search_terms": "samsung galaxy a06"
}
```
*Note: pick the LARGEST storage when multiple are listed (best chance of being
the actual SKU price). RAM goes to ram_gb separately.*

**Example 2 — accessory dressed up as the product**
```
Title: Premium Silicone Case for iPhone 15 Pro Max - Black
Category: Phones & Tablets
→ {
  "brand": "apple", "model": "iphone 15 pro max", "variant": null,
  "product_type": "accessory", "storage_gb": null, "ram_gb": null,
  "color": "black", "is_accessory": true, "confidence": "high",
  "search_terms": "iphone 15 pro max case"
}
```

**Example 3 — generic / off-brand listing**
```
Title: 2024 Latest Wireless Bluetooth Earbuds with Mic Stereo Sound
Category: Audio
→ {
  "brand": null, "model": null, "variant": null,
  "product_type": "earbuds", "storage_gb": null, "ram_gb": null,
  "inches": null, "color": null, "is_accessory": false, "confidence": "low",
  "search_terms": "wireless bluetooth earbuds"
}
```

**Example 4 — TV with bare inch number**
```
Title: Hisense 50 A6K UHD Smart TV
Category: Electronics
→ {
  "brand": "hisense", "model": "a6k", "variant": null,
  "product_type": "tv", "inches": 50,
  "color": null, "is_accessory": false, "confidence": "high",
  "search_terms": "hisense a6k 50 inch"
}
```

### Versioning

| Version | Date | Change |
|---|---|---|
| extract-v1 | 2026-04-23 | Initial release |

If you change ANY of: system prompt, tool schema, examples → bump to
`extract-v2` and the script will re-extract the whole catalog on next run.

---

## query-rewrite-v1 — (Phase 2 only) Query expansion for vector search

**Used by:** `src/lib/search/vector.ts`
**Model:** `claude-haiku-4-5`
**Mode:** JSON output

> NOT YET IMPLEMENTED. Add when Phase 2.5 work begins.

Purpose: take a user query like "cheap iphone alternative" and rewrite it
into one or more search phrases optimized for vector retrieval, e.g.
`["budget smartphone", "android flagship under 300000", "tecno phantom"]`.

---

## rerank-v1 — (Phase 3 only) LLM reranker for top-20

> NOT YET IMPLEMENTED. Add when telemetry shows quality plateaus.
