#!/usr/bin/env tsx
/* ──────────────────────────────────────────────────────────────────
   Verifies the /api/go signing round-trip (src/lib/go-signing.ts).

   Proves: a signed target verifies, a tampered target does not, an
   empty/missing signature is rejected, appendSignature attaches a
   working &sig=, and a non-/api/go URL passes through untouched.

   Run:  npx tsx scripts/verify-go-signing.ts
   ────────────────────────────────────────────────────────────────── */

try {
  // @ts-expect-error — Node 20.6+
  process.loadEnvFile?.(".env.local");
} catch { /* */ }

import { signGoTarget, verifyGoTarget, appendSignature } from "../src/lib/go-signing";

const target = "https://www.argos.co.uk/product/9876543";
const sig    = signGoTarget(target);
const goUrl  = appendSignature(`/api/go?url=${encodeURIComponent(target)}&id=abc&title=Thing`);
const sigFromUrl = new URL(goUrl, "https://havlo.io").searchParams.get("sig");

const checks: Array<[string, boolean]> = [
  ["sign + verify round-trip",   verifyGoTarget(target, sig)],
  ["tampered target rejected",   !verifyGoTarget("https://evil.example", sig)],
  ["empty signature rejected",   !verifyGoTarget(target, "")],
  ["null signature rejected",    !verifyGoTarget(target, null)],
  ["appendSignature adds &sig=", !!sigFromUrl],
  ["appended sig verifies",      verifyGoTarget(target, sigFromUrl)],
  ["non /api/go url untouched",  appendSignature("https://example.com/x") === "https://example.com/x"],
];

let pass = true;
checks.forEach(([name, ok]) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) pass = false;
});
console.log(pass ? "\nverify-go-signing: PASS" : "\nverify-go-signing: FAIL");
process.exit(pass ? 0 : 1);
