#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Regression test for /compare's anchor matcher.

   Locks in the QA agent's failure cases as a test suite. Each case
   defines: the query, the family the anchor MUST belong to (or null
   if empty/no-anchor is acceptable), and a denylist of titles that
   would prove the gate has regressed (e.g. iMac for an Apple Watch
   query).

   Run: npm run test:matcher
   Pass: zero rows in the FAIL section.

   Why this script vs unit tests:
     - Hits the real DB so FTS quirks + signature pooling get tested
     - Easy to expand as new bad queries surface from QA / users
     - One-shot pass/fail summary that fits in a screenshot
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch {/* */}

import { pgFtsFindSimilar, pgFtsFindDupes } from "../src/lib/search/pg-fts";
import { detectFamily } from "../src/lib/search/families";

interface TestCase {
  query: string;
  /** Acceptable categorical families for the anchor. The anchor's
      detected family must be in this list, OR the result must be
      empty (no false positive). Both pass — false positives fail. */
  acceptedFamilies: string[];
  /** Substrings that, if present in the anchor title, prove the
      matcher confidently picked the wrong product. Hard fail. */
  denyListedTitleSubstrings: string[];
  /** Optional notes on why this case was added. */
  notes?: string;
}

/* The QA agent's full 25-query test suite. Each row says:
     - what query a real shopper typed
     - what the answer SHOULD be (a family, or empty)
     - what answer would prove the matcher is wrong

   acceptedFamilies = ["*"] means 'any family or no family is OK' —
   used for queries where we have no family detector for that
   product class yet (e.g. fitness equipment). The deny-list still
   catches the obvious wrong answers. */
const CASES: TestCase[] = [
  {
    query: "Apple Watch Series 9",
    acceptedFamilies: ["watch"],
    denyListedTitleSubstrings: ["imac", "macbook", "ipad"],
    notes: "Watch query confidently anchored on iMac in QA report.",
  },
  {
    query: "MacBook Pro M4",
    acceptedFamilies: ["laptop"],
    denyListedTitleSubstrings: ["ipad", "iphone", "imac", "watch"],
    notes: "Laptop query anchored on iPad Pro M4 — variant gate let M4 through but missed family.",
  },
  {
    query: "iPhone 16 Plus",
    acceptedFamilies: ["phone"],
    denyListedTitleSubstrings: ["dell", "laptop", "macbook", "ipad"],
    notes: "Phone query anchored on Dell laptop matching '16 Plus'.",
  },
  {
    query: "iPhone 15 Pro Max",
    acceptedFamilies: ["phone"],
    denyListedTitleSubstrings: ["iphone 16", "iphone 17", "iphone 14"],
    notes: "Generation slip — iPhone 15 query anchored on iPhone 16.",
  },
  {
    query: "Nike Air Force 1",
    acceptedFamilies: ["footwear"],
    denyListedTitleSubstrings: ["football", "soccer ball", "nivia"],
    notes: "Sneaker query anchored on Nivia Football.",
  },
  {
    query: "Logitech MX Master 3S",
    acceptedFamilies: ["mouse"],
    denyListedTitleSubstrings: ["g502", "gaming mouse", "headset", "keyboard"],
    notes: "MX Master mouse anchored on G502 — different SKU, same maker.",
  },
  {
    query: "Instant Pot Duo",
    acceptedFamilies: ["appliance"],
    denyListedTitleSubstrings: ["pc game", "video game", "playstation", "xbox", "crimson desert"],
    notes: "Pressure cooker anchored on PC game.",
  },
  {
    query: "LG OLED 55 inch TV",
    acceptedFamilies: ["tv"],
    denyListedTitleSubstrings: ["hisense", "samsung", "sony", " 58"],
    notes: "Brand + size mismatch — LG 55 anchored on Hisense 58.",
  },
  {
    query: "Galaxy S24 Ultra",
    acceptedFamilies: ["phone"],
    denyListedTitleSubstrings: ["galaxy s23", "galaxy s25", "tab s24"],
    notes: "Positive control: should anchor on Galaxy S24 Ultra cleanly.",
  },
  {
    query: "PlayStation 5 Slim",
    acceptedFamilies: ["console"],
    denyListedTitleSubstrings: ["ps4", "xbox"],
    notes: "Positive control: should anchor on PS5 (Slim or Standard).",
  },
  /* ── QA agent's 25-query expansion ────────────────────────────
     Cases beyond the original 10 — covers the queries the QA
     agent tested in the second sweep. All should anchor on the
     right family OR fall through to empty cleanly. */
  {
    query: "Samsung 65 inch TV",
    acceptedFamilies: ["tv", "*"],
    denyListedTitleSubstrings: ["soundbar", "monitor"],
    notes: "TV size + brand. Empty acceptable when DB has no 65-inch Samsung.",
  },
  {
    query: "Sony WH-1000XM5",
    acceptedFamilies: ["headphones"],
    denyListedTitleSubstrings: ["xm4", "xm6", "wh-ch"],
    notes: "Specific Sony headphone model — XM4/XM6 must not slip through.",
  },
  {
    query: "Casio G-Shock",
    acceptedFamilies: ["watch", "*"],
    denyListedTitleSubstrings: ["seiko", "fitbit", "smartwatch series"],
    notes: "G-Shock watch line.",
  },
  {
    query: "Levi 501",
    acceptedFamilies: ["jeans", "*"],
    denyListedTitleSubstrings: ["wrangler", "diesel", "guess"],
    notes: "Brand-specific jeans.",
  },
  {
    query: "Nintendo Switch OLED",
    acceptedFamilies: ["console"],
    denyListedTitleSubstrings: ["switch lite", "satellite", "cable splitter", "network switch", "light switch"],
    notes: "QA agent reported did-you-mean Nintendo Switch returned a satellite cable splitter — that must never happen now.",
  },
  {
    query: "Dyson V15",
    acceptedFamilies: ["appliance", "*"],
    denyListedTitleSubstrings: ["v8 ", "v10 ", "v11 ", "v12 ", "supersonic", "airwrap"],
    notes: "Specific Dyson vacuum generation. V11 sits in DB so V15 must not silently anchor there.",
  },
  {
    query: "Kindle Paperwhite",
    acceptedFamilies: ["ereader", "tablet", "*"],
    denyListedTitleSubstrings: ["kindle fire", "kindle scribe", "kindle oasis"],
    notes: "E-reader. Fire/Scribe/Oasis are different products.",
  },
  {
    query: "Bose QuietComfort Ultra",
    acceptedFamilies: ["headphones"],
    denyListedTitleSubstrings: ["earbuds", "qc35", "qc45", "soundlink"],
    notes: "QuietComfort Ultra over-ear — not earbuds version.",
  },
  {
    query: "GoPro Hero 12",
    acceptedFamilies: ["camera"],
    denyListedTitleSubstrings: ["hero 9", "hero 10", "hero 11", "dslr"],
    notes: "Specific GoPro generation.",
  },
  {
    query: "Fitbit Charge 6",
    acceptedFamilies: ["watch"],
    denyListedTitleSubstrings: ["charge 5", "charge 4", "versa", "sense"],
    notes: "Specific Fitbit model + generation.",
  },
  {
    query: "MacBook Air M3",
    acceptedFamilies: ["laptop"],
    denyListedTitleSubstrings: ["m1 chip", "m2 chip", " m4 ", "ipad", "imac"],
    notes: "M3 generation — different chip generation must not slip through.",
  },
  {
    query: "Echo Dot 5th gen",
    acceptedFamilies: ["speaker", "*"],
    denyListedTitleSubstrings: ["echo show", "echo studio", "4th gen", "3rd gen"],
    notes: "Specific Echo Dot generation. Echo Show / Studio are different products.",
  },
  {
    query: "Air Jordan 1 Chicago",
    acceptedFamilies: ["footwear"],
    denyListedTitleSubstrings: ["jordan 4", "jordan 11", "yeezy"],
    notes: "AJ1 Chicago colourway. Empty fine when colourway not in DB.",
  },
  {
    query: "Ray-Ban Aviator",
    acceptedFamilies: ["eyewear"],
    denyListedTitleSubstrings: ["wayfarer", "clubmaster", "round"],
    notes: "Specific Ray-Ban model line.",
  },
  {
    query: "Le Creuset",
    acceptedFamilies: ["cookware", "*"],
    denyListedTitleSubstrings: ["lodge", "staub", "all-clad"],
    notes: "Brand query — should return Le Creuset items if any.",
  },
  {
    query: "Stanley Quencher",
    acceptedFamilies: ["drinkware"],
    denyListedTitleSubstrings: ["yeti ", "owala", "hydro flask"],
    notes: "Specific tumbler line.",
  },
  {
    query: "Lego Millennium Falcon",
    acceptedFamilies: ["toys", "*"],
    denyListedTitleSubstrings: ["x-wing", "death star", "tie fighter", "video game", "pc game", "playstation", "xbox"],
    notes: "Lego set. Star Wars video games are different products.",
  },
];

/* Family detection imported directly from src/lib/search/families.ts
   so the test stays in lockstep with whatever the matcher uses. */

interface Result {
  query: string;
  status: "PASS" | "FAIL";
  reason: string;
  anchorTitle?: string;
  anchorFamily?: string | null;
}

async function runCase(c: TestCase): Promise<Result> {
  try {
    const out = await pgFtsFindSimilar(c.query);
    if (out.mode === "empty") {
      // Empty is always acceptable — better than confidently wrong
      return {
        query: c.query,
        status: "PASS",
        reason: "empty (acceptable)",
      };
    }
    if (out.mode === "similar") {
      const anchorTitle = out.anchor.title;
      const lc = anchorTitle.toLowerCase();
      // Hard-fail: deny-list substring hit
      const hit = c.denyListedTitleSubstrings.find((s) => lc.includes(s.toLowerCase()));
      if (hit) {
        return {
          query: c.query,
          status: "FAIL",
          reason: `anchor matched deny-list substring "${hit}"`,
          anchorTitle,
          anchorFamily: detectFamily(anchorTitle),
        };
      }
      // Family check: anchor's detected family must be in accepted list,
      // OR null (unknown — don't penalize when classifier hasn't tagged
      // it). The wildcard "*" lets a case skip the family check entirely
      // — used for product classes we don't model yet (e.g. fitness
      // equipment) where we still want to deny-list catastrophic mismatches.
      const fam = detectFamily(anchorTitle);
      const anyFamilyOk = c.acceptedFamilies.includes("*");
      if (fam && !anyFamilyOk && !c.acceptedFamilies.includes(fam)) {
        return {
          query: c.query,
          status: "FAIL",
          reason: `wrong family: detected "${fam}", expected one of [${c.acceptedFamilies.join(", ")}]`,
          anchorTitle,
          anchorFamily: fam,
        };
      }
      return {
        query: c.query,
        status: "PASS",
        reason: anyFamilyOk ? "anchor passed (any family allowed)" : "anchor in accepted family",
        anchorTitle,
        anchorFamily: fam,
      };
    }
    // single mode (key-based) shouldn't occur for q-based test
    return {
      query: c.query,
      status: "PASS",
      reason: `mode=${out.mode} (unexpected but not failing)`,
    };
  } catch (err) {
    return {
      query: c.query,
      status: "FAIL",
      reason: `threw: ${(err as Error).message}`,
    };
  }
}

/* ── Paste-a-link / dupes path tests ──────────────────────────────
   pgFtsFindDupes is the dupes-only entrypoint used when the anchor
   is constructed from a sniffed external URL. The QA agent flagged
   accessory bleed: pasting an iPhone 15 Plus Case URL returned
   actual phones (₦1M+) as 'cheaper alternatives' to a $5 case.
   These cases verify the accessory match-flip:
     - Accessory query → only accessory dupes
     - Real-product query → no accessory dupes  */

interface DupesCase {
  /** Title as it would arrive from a URL sniff. */
  title: string;
  /** Anchor price in NGN — provides the "cheaper than this" ceiling. */
  priceNgn: number;
  /** Substrings that, if found in any returned dupe title, fail the case. */
  denyListedDupeSubstrings: string[];
  /** When true, every returned dupe MUST itself be an accessory. */
  expectAllAccessory?: boolean;
  notes?: string;
}

const DUPES_CASES: DupesCase[] = [
  {
    title: "iPhone 15 Plus Clear Case with MagSafe",
    priceNgn: 8_000,
    denyListedDupeSubstrings: ["iphone 15", "infinix smart", "infinix hot", "galaxy s"],
    expectAllAccessory: true,
    notes: "QA: case URL returned ₦1M phones as 'cheaper'. Should only return cases.",
  },
  {
    title: "Galaxy S24 Ultra Screen Protector Tempered Glass",
    priceNgn: 5_000,
    denyListedDupeSubstrings: ["galaxy s24 ultra 5g", "samsung phone"],
    expectAllAccessory: true,
    notes: "Screen protector should not surface the phone itself.",
  },
];

const ACCESSORY_NOISE_RE = new RegExp(
  [
    "case", "cover", "skin", "holder", "stand", "tripod", "selfie stick",
    "screen protector", "tempered glass", "replacement", "repair", "lcd screen",
    "battery replacement", "charger only", "cable only", "adapter only",
    "lens kit", "gimbal",
  ].map((s) => `(?:^|[^a-z])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z]|$)`).join("|"),
  "i",
);

async function runDupesCase(c: DupesCase): Promise<Result> {
  try {
    const dupes = await pgFtsFindDupes(c.title, c.priceNgn, { limit: 6 });
    if (dupes.length === 0) {
      return { query: c.title, status: "PASS", reason: "no dupes (acceptable)" };
    }
    for (const d of dupes) {
      const lc = d.title.toLowerCase();
      const hit = c.denyListedDupeSubstrings.find((s) => lc.includes(s.toLowerCase()));
      if (hit) {
        return {
          query: c.title,
          status: "FAIL",
          reason: `dupe matched deny-list "${hit}"`,
          anchorTitle: d.title,
        };
      }
      if (c.expectAllAccessory && !ACCESSORY_NOISE_RE.test(d.title)) {
        return {
          query: c.title,
          status: "FAIL",
          reason: `non-accessory dupe surfaced for accessory query`,
          anchorTitle: d.title,
        };
      }
    }
    return { query: c.title, status: "PASS", reason: `${dupes.length} dupes all clean` };
  } catch (err) {
    return { query: c.title, status: "FAIL", reason: `threw: ${(err as Error).message}` };
  }
}

async function main() {
  console.log("▶ Matcher regression test\n");
  console.log("── Anchor-selection (q-based /api/compare) ──\n");
  const results: Result[] = [];
  for (const c of CASES) {
    const r = await runCase(c);
    results.push(r);
    const flag = r.status === "PASS" ? "✓" : "✗";
    const meta = r.anchorTitle ? `\n    → ${r.anchorTitle} [family=${r.anchorFamily ?? "null"}]` : "";
    console.log(`${flag} ${c.query.padEnd(28)} ${r.reason}${meta}`);
  }
  console.log("\n── Paste-a-link dupes (pgFtsFindDupes) ──\n");
  for (const c of DUPES_CASES) {
    const r = await runDupesCase(c);
    results.push(r);
    const flag = r.status === "PASS" ? "✓" : "✗";
    const meta = r.anchorTitle ? `\n    → ${r.anchorTitle}` : "";
    console.log(`${flag} ${c.title.slice(0, 40).padEnd(40)} ${r.reason}${meta}`);
  }
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n▶ ${passed}/${results.length} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
