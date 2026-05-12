/* Probe: which UK-shaped storeId/name combinations does inferStoreCountry
   recognize? Covers SerpAPI canonical variants AND the explicit `key`
   values from scripts/ingest-uk-retailers.ts (which become storeId in DB). */
import { inferStoreCountry, isGlobalIntlStore } from "../src/lib/country";

const cases = [
  // Common SerpAPI source strings for UK retailers
  { id: "amazon-uk",       name: "Amazon UK" },
  { id: "argos",           name: "Argos" },
  { id: "currys",          name: "Currys" },
  { id: "john-lewis",      name: "John Lewis" },
  { id: "john-lewis-partners", name: "John Lewis & Partners" },
  { id: "ao",              name: "AO.com" },
  { id: "very",            name: "Very" },
  { id: "very-co-uk",      name: "Very.co.uk" },
  { id: "asos",            name: "ASOS" },
  { id: "boots",           name: "Boots" },
  { id: "next",            name: "Next" },
  { id: "marks-spencer",   name: "Marks & Spencer" },
  { id: "selfridges",      name: "Selfridges" },
  { id: "screwfix",        name: "Screwfix" },
  { id: "wickes",          name: "Wickes" },
  { id: "halfords",        name: "Halfords" },
  { id: "ebay-co-uk",      name: "eBay UK" },
  { id: "ebay-uk",         name: "eBay UK" },
  { id: "ebay",            name: "eBay" },              // global marketplace
  { id: "tesco",           name: "Tesco" },
  { id: "sainsbury",       name: "Sainsbury's" },
  { id: "dunelm",          name: "Dunelm" },
  { id: "smyths",          name: "Smyths Toys" },
  { id: "b-q",             name: "B&Q" },
  // ingest-uk-retailers.ts `key` values (these BECOME storeId in DB)
  { id: "marks",           name: "Marks & Spencer" },   // key: "marks"
  { id: "ao",              name: "AO.com" },             // key: "ao"
  { id: "bq",              name: "B&Q" },                // key: "bq"
  { id: "jd",              name: "JD Sports" },          // key: "jd"
  // Gap retailers (previously missing)
  { id: "ikea",            name: "IKEA" },
  { id: "ikea-co-uk",      name: "IKEA UK" },
  { id: "waitrose",        name: "Waitrose" },
  { id: "ocado",           name: "Ocado" },
  { id: "morrisons",       name: "Morrisons" },
  { id: "iceland",         name: "Iceland" },
  { id: "aldi",            name: "Aldi UK" },
  { id: "tk-maxx",         name: "TK Maxx" },
  { id: "wilko",           name: "Wilko" },
  { id: "lidl",            name: "Lidl" },              // multi-market (DE wins first-match)
];

let ukOk = 0, ukLeak = 0;
for (const c of cases) {
  const country = inferStoreCountry(c.id, c.name);
  const globalIntl = isGlobalIntlStore(c.id, c.name);
  const isUk    = country === "UK";
  const isNull  = country === null && !globalIntl;
  const flag = isUk ? "✓ UK"
             : isNull ? "✗ NULL (currency fallback → INTL)"
             : `↳ ${country ?? "GLOBAL"}`;
  if (isUk) ukOk++;
  else ukLeak++;
  console.log(`  ${c.id.padEnd(22)} | ${c.name.padEnd(28)} | ${flag}`);
}
console.log(`\nUK matches: ${ukOk}/${cases.length}  ·  Leaks: ${ukLeak}`);
