/* One-off verification for the Jun 2026 NULL-signature recovery.
   Runs the LIVE buildSignature over (a) the fixable branded titles we want to
   recover, and (b) the adversary's danger cases that MUST stay separate / NULL.
   Run: npx tsx scripts/maint/verify-null-sig-fix.ts */
import { buildSignature } from "../../src/lib/search/normalize";

const sig = (t: string) => {
  const s = buildSignature(t);
  return `${s.brand ?? "∅"}|${s.model ?? "∅"}`;
};

console.log("── FIXABLE (want a tight brand|model) ──");
const fixable = [
  "Motorola Edge 2022",
  "Motorola Moto G15",
  "Motorola moto G06 4G Dual SIM",
  "iQOO Z9s Pro 5G",
  "REDMAGIC 11 Pro Gaming Smartphone Dual Sim",
  "boAt Airdopes 213 TWS Earbuds",
  "boAt Rockerz 450 Bluetooth Headphones",
  "Astro A50 X McLaren Edition LIGHTSPEED Wireless Gaming Headset",
  "Astro A50 Wireless Gaming Headset",
  "GoPro HERO12 Black",
  "GoPro Hero 12 Black",
  "HMD Skyline 256GB",
  "Beko GN14790PX American Fridge Freezer",
  "Amica ADV7CLCW Vented Tumble Dryer",
  "Nutribullet 600 Series Blender",
  "Marantz PM6007 Integrated Amplifier",
  "Audioengine B2 Bluetooth Speaker",
  "Cubitt VIVA Smartwatch",
];
for (const t of fixable) console.log(`  ${sig(t).padEnd(26)}  ${t}`);

console.log("\n── DANGER (must stay SEPARATE or NULL — no over-grouping) ──");
const danger: [string, string][] = [
  ["Astro A50 X McLaren Edition Wireless Gaming Headset", "astro|a50 x"],
  ["Astro A50 Wireless Gaming Headset", "astro|a50  (must DIFFER from a50 x)"],
  ["TFNC London boat neck full skirt mini dress", "NOT brand=boat (apparel)"],
  ["Topshop 90s boat neck top", "NOT brand=boat (apparel)"],
  ["NOAK boat shoes brown leather", "NOT brand=boat (footwear)"],
  ["Astro Turf Artificial Grass 4m roll", "NOT brand=astro (or NULL model)"],
  ["Mac-Book Air M3 (2024) 15inch Laptop", "NOT brand=mac (should be apple/∅)"],
  ["MAC Mac and cheese ready meal", "NOT brand=mac"],
  ["Samsung 65 Inch QLED 4K Smart TV", "pre-existing size bug, deferred — just observe"],
  ["FG Wilson 13KVA Diesel Generator", "NOT brand=wilson (omitted)"],
  ["Mitre Saw 1800W Sliding Compound", "NOT brand=mitre (omitted)"],
];
for (const [t, expect] of danger) console.log(`  ${sig(t).padEnd(26)}  ${t}\n      expect: ${expect}`);

console.log("\n── SIZE-AS-MODEL (must become NULL model — was over-grouping) ──");
const sizeBad = [
  "Samsung 65 Inch QLED 4K Smart TV",
  "TCL 43 Inches Android Smart TV",
  "Hisense 55 inch UHD TV",
  "LG 24 inch IPS Monitor",
  "KitchenAid 36 in Gas Cooktop",
  "Mango 100% Leather Crossbody Bag",
  "Mango 100% Cotton Oversized Shirt",
  "HP 15 Laptop Intel Core i5",
  "Asus 15 Notebook",
  "Dell 16 Laptop Premium",
  'Samsung 55" Crystal UHD TV',
];
for (const t of sizeBad) console.log(`  ${sig(t).padEnd(26)}  ${t}`);

console.log("\n── SIZE GUARD MUST NOT BREAK THESE (real numbered models) ──");
const sizeGood = [
  "Anker 737 Power Bank PowerCore 24000",
  "Anker 313 Wall Charger",
  "Anker 523 Nano Charger",
  "HP 15-fc0057ni Laptop Ryzen 5",
  "HP 15-dw3145ne Notebook",
  "Hisense 50A6K 4K TV",
  "JBL Clip 4 Portable Bluetooth Speaker",
  "Xiaomi 14 Pro 5G Smartphone",
  "Realme 12 Pro Plus",
];
for (const t of sizeGood) console.log(`  ${sig(t).padEnd(26)}  ${t}`);

console.log("\n── REGRESSION (existing good signatures must be unchanged) ──");
const regression = [
  "Apple iPhone 15 Pro Max 256GB",
  "Sony WH-1000XM5 Wireless Headphones",
  "MAC Lipstick Ruby Woo",
];
for (const t of regression) console.log(`  ${sig(t).padEnd(26)}  ${t}`);
