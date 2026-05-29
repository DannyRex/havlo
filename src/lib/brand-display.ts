/* Brand display-name helper.

   Background: ingestion.ts stores `products.brand` as the lowercase
   form ("apple", "samsung", "lg") because the signature parser
   normalises before persisting. Render-time surfaces want proper
   display casing — "Apple", "Samsung", "LG". A naïve title-case
   breaks the stylised brands (LG → "Lg", HP → "Hp", iRobot →
   "Irobot", L'Oréal → "L'oréal"), so we use an explicit map with
   title-case as fallback.

   Centralised so the hero eyebrow pill, ProductAbout intro line,
   and any future surface (compare anchor card, deal-card brand
   chip, ...) render the same string for the same raw input. Add
   new entries here whenever a new brand appears in the catalog
   with non-trivial casing. */

const BRAND_DISPLAY: Record<string, string> = {
  apple:        "Apple",
  samsung:      "Samsung",
  google:       "Google",
  microsoft:    "Microsoft",
  sony:         "Sony",
  lg:           "LG",
  hp:           "HP",
  dell:         "Dell",
  asus:         "Asus",
  lenovo:       "Lenovo",
  bose:         "Bose",
  jbl:          "JBL",
  beats:        "Beats",
  nike:         "Nike",
  adidas:       "Adidas",
  puma:         "Puma",
  fenty:        "Fenty",
  maybelline:   "Maybelline",
  loreal:       "L'Oréal",
  oraimo:       "Oraimo",
  xiaomi:       "Xiaomi",
  tecno:        "Tecno",
  infinix:      "Infinix",
  itel:         "Itel",
  irobot:       "iRobot",
  bang:         "Bang & Olufsen",
  harman:       "Harman Kardon",
  asos:         "ASOS",
  hm:           "H&M",
  zara:         "Zara",
  uniqlo:       "Uniqlo",
  nivea:        "Nivea",
  dove:         "Dove",
  garnier:      "Garnier",
  schwarzkopf:  "Schwarzkopf",
  philips:      "Philips",
  panasonic:    "Panasonic",
  toshiba:      "Toshiba",
  hisense:      "Hisense",
  tcl:          "TCL",
  haier:        "Haier",
  bosch:        "Bosch",
  siemens:      "Siemens",
  whirlpool:    "Whirlpool",
  electrolux:   "Electrolux",
  midea:        "Midea",
  acer:         "Acer",
  msi:          "MSI",
  razer:        "Razer",
  logitech:     "Logitech",
  cosrx:        "COSRX",
  thefaceshop:  "The Face Shop",
  innisfree:    "Innisfree",
};

/** Returns the proper display form of a brand, or null if the input
    is null/empty. Falls back to title-case for brands not in the map. */
export function brandDisplay(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim();
  if (!k) return null;
  if (BRAND_DISPLAY[k]) return BRAND_DISPLAY[k];
  /* Title-case fallback handles whitespace-separated multi-word
     brands ("monster energy" → "Monster Energy"). Apostrophes and
     other punctuation pass through unchanged. */
  return k
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
