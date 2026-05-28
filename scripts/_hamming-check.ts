import { hammingDistance } from "../src/lib/search/phash";
const pairs: Array<[string, bigint, bigint]> = [
  ["M4 16\" anchor vs M5 14\" leak (0d283fee)", BigInt("19478301293242624"), BigInt("-9203893735563370000")],
  ["M4 16\" anchor vs M5 14\" alt (d72de9a3)", BigInt("19478301293242624"), BigInt("28553403981183744")],
  ["M4 16\" anchor vs M4 short (87fb534e)", BigInt("19478301293242624"), BigInt("3684827588434013000")],
];
for (const [label, a, b] of pairs) {
  console.log(`${label}: hamming=${hammingDistance(a, b)}`);
}
