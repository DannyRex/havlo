import {
  extractRequiredNumbers,
  extractRequiredModelTokens,
  extractVariantTokens,
  isLikelySameProduct,
} from "../src/lib/search/query-understanding";

const pairs = [
  { a: "Apple 16-inch MacBook Pro Apple M4 chip",
    c: "Apple MacBook Pro 14-inch M5 Chip with 10-core CPU" },
  { a: "Apple 16-inch MacBook Pro Apple M4 chip",
    c: "Apple 16\" Macbook Pro (M4 Pro, Space Black)" },
];

for (const p of pairs) {
  console.log(`\nA: "${p.a}"`);
  console.log(`C: "${p.c}"`);
  const aN = extractRequiredNumbers(p.a);
  const cN = extractRequiredNumbers(p.c);
  const aM = extractRequiredModelTokens(p.a);
  const cM = extractRequiredModelTokens(p.c);
  const aV = extractVariantTokens(p.a);
  const cV = extractVariantTokens(p.c);
  console.log(`  A: numbers=${JSON.stringify(aN)} models=${JSON.stringify(aM)} variants=${JSON.stringify(aV)}`);
  console.log(`  C: numbers=${JSON.stringify(cN)} models=${JSON.stringify(cM)} variants=${JSON.stringify(cV)}`);
  const aUniqN = aN.filter((n) => !cN.includes(n));
  const cUniqN = cN.filter((n) => !aN.includes(n));
  const aUniqM = aM.filter((m) => !cM.includes(m));
  const cUniqM = cM.filter((m) => !aM.includes(m));
  const aUniqV = aV.filter((v) => !cV.includes(v));
  const cUniqV = cV.filter((v) => !aV.includes(v));
  console.log(`  Veto: numbers ${aUniqN.length > 0 && cUniqN.length > 0 ? "VETO" : "pass"}`);
  console.log(`  Veto: models  ${aUniqM.length > 0 && cUniqM.length > 0 ? "VETO" : "pass"}`);
  console.log(`  Veto: variants ${aUniqV.length > 0 || cUniqV.length > 0 ? "VETO" : "pass"} (aUniq=${JSON.stringify(aUniqV)} cUniq=${JSON.stringify(cUniqV)})`);
  const sync = isLikelySameProduct({ title: p.a, brand: "apple", priceNgn: 1_000_000 }, { title: p.c, brand: "apple", priceNgn: 1_000_000 });
  console.log(`  sync isLikelySameProduct = ${sync}`);
}
