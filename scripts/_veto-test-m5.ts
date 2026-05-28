import {
  extractRequiredNumbers,
  extractRequiredModelTokens,
  extractVariantTokens,
} from "../src/lib/search/query-understanding";

const a = "Apple 16-inch MacBook Pro Apple M4 chip";
const c = "Apple MacBook Pro 14-inch M5 Chip with 10-core CPU and 10-core GPU";

const aN = extractRequiredNumbers(a);
const cN = extractRequiredNumbers(c);
const aM = extractRequiredModelTokens(a);
const cM = extractRequiredModelTokens(c);
const aV = extractVariantTokens(a);
const cV = extractVariantTokens(c);

console.log(`A: "${a}"`);
console.log(`  numbers=${JSON.stringify(aN)} models=${JSON.stringify(aM)} variants=${JSON.stringify(aV)}`);
console.log(`C: "${c}"`);
console.log(`  numbers=${JSON.stringify(cN)} models=${JSON.stringify(cM)} variants=${JSON.stringify(cV)}`);

const aUniqN = aN.filter((n) => !cN.includes(n));
const cUniqN = cN.filter((n) => !aN.includes(n));
const aUniqM = aM.filter((m) => !cM.includes(m));
const cUniqM = cM.filter((m) => !aM.includes(m));
const aUniqV = aV.filter((v) => !cV.includes(v));
const cUniqV = cV.filter((v) => !aV.includes(v));

console.log(`\nVeto checks:`);
console.log(`  numbers:  aUniq=${JSON.stringify(aUniqN)} cUniq=${JSON.stringify(cUniqN)} → ${aUniqN.length > 0 && cUniqN.length > 0 ? "VETO" : "pass"}`);
console.log(`  models:   aUniq=${JSON.stringify(aUniqM)} cUniq=${JSON.stringify(cUniqM)} → ${aUniqM.length > 0 && cUniqM.length > 0 ? "VETO" : "pass"}`);
console.log(`  variants: aUniq=${JSON.stringify(aUniqV)} cUniq=${JSON.stringify(cUniqV)} → ${aUniqV.length > 0 || cUniqV.length > 0 ? "VETO" : "pass"}`);
