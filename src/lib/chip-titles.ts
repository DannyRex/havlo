/* Friendlification helper for the multi-store chip rail on /compare.

   The DB stores raw merchant titles which are perfect for FTS but
   feel hostile as homepage / suggestion-rail labels. Examples of
   what comes out of products.title:

     • "Apple iPhone 17 Pro"
     • "SAMSUNG Galaxy A06-A065F Android Mobile Smart Phone With
        64GB+4GB & 128GB+4GB"
     • "Samsung Galaxy A26 5g - 128gb Rom + 6gb Ram - 6.7\" -"
     • "Xiaomi Redmi 15c 128GB 4G Dual Sim Cellphone - Black -
        Box Deal - Telk"
     • "APPLE AIRPODS 4"
     • "JBL Go 4 Portable Bluetooth Speaker"

   What real shoppers want to TYPE / RECOGNISE on a chip:

     • iPhone 17 Pro
     • Galaxy A06
     • Galaxy A26 5G
     • Redmi 15c
     • AirPods 4
     • JBL Go 4

   Rules applied (in order):
     1. Cut at the first piece of spec metadata real shoppers don't
        type ("Android Mobile Smart Phone", "with 64GB", "Cellphone",
        screen sizes, etc.).
     2. Drop trailing model code suffix ("-A065F", "(8+8gb").
     3. Strip trailing punctuation (" -", " /", " |", etc.) from the
        cut.
     4. Title-case shouty brand names BUT preserve known acronyms
        (JBL / HP / LG / TCL / JVC stay all-caps).
     5. Drop redundant brand prefix when the brand sits next to its
        own product line ("Apple iPhone" → "iPhone", "Apple AirPods"
        → "AirPods", "Apple MacBook" → "MacBook").
     6. Cap at 32 chars at a word boundary.

   The pool that feeds this function is already cross-store-overlap
   filtered AND junk-filtered (looksLikeChipJunk in
   trending-multi-store.ts), so this just polishes the labels —
   we don't try to rescue truly bad titles here. */

const FRIENDLY_TITLE_MAX_LEN = 32;

/* Brands we always want to write in mixed case even if the merchant
   yelled them in the title. Apple / Samsung / Sony etc. */
const SHOUTY_BRANDS = new Set([
  "apple", "samsung", "sony", "xiaomi", "huawei", "motorola",
  "nokia", "honor", "lenovo", "panasonic", "philips", "bosch",
  "infinix", "tecno", "redmi", "oppo", "vivo", "oneplus",
  "google", "microsoft", "asus", "acer", "razer",
  "nike", "adidas", "yeezy", "puma", "reebok", "fila",
  "logitech", "corsair", "dyson", "bose", "marshall",
  "kitchenaid", "kenwood", "ninja", "cuisinart",
]);

/* Just title-case the FIRST WORD (brand) when it's all-caps, leave
   everything else alone. Safer than the previous global pattern
   which mangled WH-1000XM6 → Wh-1000XM6 and CPU → Cpu. */
function titleCaseBrand(s: string): string {
  const m = s.match(/^([A-Z]{2,})\b/);
  if (!m) return s;
  const brand = m[1];
  if (!SHOUTY_BRANDS.has(brand.toLowerCase())) return s;
  return brand[0] + brand.slice(1).toLowerCase() + s.slice(brand.length);
}

export function friendlifyChipTitle(raw: string): string {
  /* Strip embedded HTML markup before any other rule fires. DHgate /
     SerpAPI seller feeds occasionally include <strong>keyword</strong>
     tags inside titles; without this strip, the rules below try to
     "friendlify" content like "<strong>shoes</strong>" and leave junk
     in the chip label. */
  let t = raw.replace(/<[^>]*>/g, "").trim();

  /* 1. Cut at spec metadata. The regex is anchored on whole-word
     boundaries so "G4" stays intact while "with 64gb" gets dropped. */
  const cutPattern = /\s+(?:android\s+mobile|smart\s+phone|smart\s+mobile|smartphone|cellphone|with\s+\d|wireless\s+(?:earbuds|headphones)|noise\s+cancelling|portable\s+bluetooth|active\s+noise|dual\s+sim|unlocked|box\s+deal|rom\s*\+|ram|\d+\s*gb\s*\+|\d+\.\d+\s*inch|\d+\.\d+["”]|6\.\d|\(\d|\|\s|\d+gb\s+rom)/i;
  const cut = t.match(cutPattern);
  if (cut?.index !== undefined) t = t.slice(0, cut.index).trim();

  /* 2. Drop trailing alphanumeric model-code suffix. Common SerpAPI
     and AliExpress pattern: "Galaxy A06-A065F" → "Galaxy A06". The
     regex is conservative: needs at least one digit AND at least 4
     chars to avoid eating real model identifiers. */
  t = t.replace(/-\s*[A-Z][A-Z0-9]{3,}$/i, "").trim();

  /* 3. Strip trailing punctuation / separators left over from the
     cuts above ("Samsung Galaxy A26 5g -" → "Samsung Galaxy A26 5g"). */
  t = t.replace(/[\s/|\-,&+:.]+$/, "").trim();

  /* 4. Title-case the brand prefix only (leave model codes /
     acronyms / spec tokens alone — they'd lose meaning if turned
     into "Wh-1000XM6" or "Cpu Gpu"). Then re-apply special-cases:
     "AIRPODS" → "AirPods", "AIRPODS PRO" → "AirPods Pro". */
  t = titleCaseBrand(t);
  /* Canonical Apple-branded camelCase. Case-insensitive so we
     normalise "Airpods" / "AIRPODS" / "airpods" → "AirPods". */
  t = t.replace(/\bairpods\b/gi, "AirPods");
  t = t.replace(/\bmacbook\b/gi, "MacBook");
  t = t.replace(/\biphone\b/gi, "iPhone");
  t = t.replace(/\bipad\b/gi, "iPad");
  t = t.replace(/\bimac\b/gi, "iMac");
  /* 'Galaxy S25 Fe' → 'Galaxy S25 FE'. titleCaseBrand only touched
     the leading brand so 'FE' wasn't broken, but inputs like
     'Samsung Galaxy S25 FE' stay intact; the issue arose with
     mixed-case inputs like 'Samsung Galaxy S25 Fe' (already
     half-cased). Force common phone suffix codes back to upper. */
  t = t.replace(/\b(fe|se|xl|ue|nfc|tv|hd|uhd|qled|oled|led|lte|mp|gb|tb|ram|rom|cpu|gpu|usb|hdmi)\b/gi, (m) => m.toUpperCase());
  /* "5g" / "4g" → "5G" / "4G" */
  t = t.replace(/\b(\d+)g\b/g, "$1G");

  /* 5. Drop "Apple " prefix when followed by an Apple product line.
     Apple's own marketing usually omits the brand (you don't say
     "Apple iPhone", you say "iPhone"). */
  t = t.replace(/^Apple\s+(?=iPhone|iPad|MacBook|AirPods|Watch\s|Vision)/i, "");

  /* 6. Cap at 32 chars on a word boundary. Prevents overflow chips
     when a product slips through with a long flagship-extension
     suffix (e.g. "Samsung Galaxy S22/S22+/S22 Ultra" → "Samsung
     Galaxy S22"). */
  if (t.length > FRIENDLY_TITLE_MAX_LEN) {
    const sliced = t.slice(0, FRIENDLY_TITLE_MAX_LEN);
    const lastSpace = sliced.lastIndexOf(" ");
    t = (lastSpace > 12 ? sliced.slice(0, lastSpace) : sliced).trim();
    /* After truncation, re-strip any trailing punctuation. */
    t = t.replace(/[\s/|\-,&+:.]+$/, "").trim();
  }

  return t;
}
