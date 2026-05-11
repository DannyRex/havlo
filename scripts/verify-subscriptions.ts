#!/usr/bin/env tsx
/* End-to-end check for the two email-capture flows that gate the
   launch waitlist:
     1. /api/newsletter        → newsletter_subscribers
     2. /api/cashback-waitlist → cashback_waitlist

   For each:
     a. POST a test email
     b. Confirm HTTP 200 + { ok: true }
     c. Confirm the row landed in the right table with the right
        (email, source) shape
     d. Clean up the test row so it doesn't pollute real signups

   Run before launch to confirm both endpoints are wired end-to-end:
     npx tsx --tsconfig tsconfig.scripts.json scripts/verify-subscriptions.ts
     npx tsx --tsconfig tsconfig.scripts.json scripts/verify-subscriptions.ts --base-url=http://localhost:3000

   Defaults to production (havlo.io). Pass --base-url to point at a
   local dev server or preview deployment instead. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

interface Args {
  baseUrl: string;
}

function parseArgs(): Args {
  let baseUrl = "https://havlo.io";
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--base-url=")) baseUrl = arg.slice("--base-url=".length);
  }
  return { baseUrl: baseUrl.replace(/\/$/, "") };
}

interface TestResult {
  flow:       string;
  status:     "PASS" | "FAIL";
  details:    string[];
  failure?:   string;
}

async function testSubscription(
  baseUrl: string,
  path:    "/api/newsletter" | "/api/cashback-waitlist",
  table:   "newsletter_subscribers" | "cashback_waitlist",
  source:  string,
  flowLabel: string,
): Promise<TestResult> {
  const details: string[] = [];
  const supa = getSupabaseAdmin();
  if (!supa) {
    return { flow: flowLabel, status: "FAIL", details, failure: "Supabase admin client unavailable" };
  }

  /* Test email uses Resend's sandbox address with a +tag suffix
     for uniqueness across concurrent / repeated runs. Resend
     accepts `delivered@resend.dev` and simulates a successful
     delivery without firing a real send — safe to use as often as
     we want without dinging our domain reputation. The +tag part
     keeps each run distinct so duplicate-key upserts don't merge. */
  const stamp = Date.now();
  const email = `delivered+sub-${stamp}@resend.dev`;
  const country = "ng";

  details.push(`email: ${email}`);
  details.push(`POST ${baseUrl}${path}`);

  /* a. Submit */
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, country, source }),
    });
  } catch (err) {
    return {
      flow: flowLabel, status: "FAIL", details,
      failure: `fetch failed: ${(err as Error).message}`,
    };
  }

  details.push(`HTTP ${res.status}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable body)");
    return {
      flow: flowLabel, status: "FAIL", details,
      failure: `non-200 response: ${res.status} ${body.slice(0, 200)}`,
    };
  }

  /* b. JSON body should say ok:true */
  let body: { ok?: boolean; error?: string; note?: string } = {};
  try { body = await res.json(); } catch {
    return { flow: flowLabel, status: "FAIL", details, failure: "response wasn't JSON" };
  }
  details.push(`body: ${JSON.stringify(body)}`);
  if (!body.ok) {
    return { flow: flowLabel, status: "FAIL", details, failure: body.error ?? "ok:false" };
  }

  /* c. DB row check. Defensive: pre-migration the routes return
     ok:true with a "note" field; surface that as a soft-fail so
     the user knows the row didn't actually land. */
  if (body.note) {
    return {
      flow: flowLabel, status: "FAIL", details,
      failure: `route returned ok:true but with a note: "${body.note}" — migration may not be applied`,
    };
  }

  const { data: row, error: readErr } = await supa
    .from(table)
    .select("email, source, country")
    .eq("email", email)
    .eq("source", source)
    .maybeSingle();
  if (readErr) {
    return {
      flow: flowLabel, status: "FAIL", details,
      failure: `DB read failed: ${readErr.message}`,
    };
  }
  if (!row) {
    return {
      flow: flowLabel, status: "FAIL", details,
      failure: `row not found in ${table} after POST returned ok:true`,
    };
  }
  details.push(`row found in ${table}: email=${row.email}, source=${row.source}, country=${row.country}`);

  /* d. Cleanup. Strict (email, source) match so we never delete
     real signups. */
  const { error: delErr } = await supa
    .from(table)
    .delete()
    .eq("email", email)
    .eq("source", source);
  if (delErr) {
    details.push(`⚠ cleanup failed: ${delErr.message}`);
  } else {
    details.push(`✓ test row cleaned up`);
  }

  return { flow: flowLabel, status: "PASS", details };
}

async function main() {
  const args = parseArgs();
  console.log(`▶ Verifying subscription endpoints at ${args.baseUrl}\n`);

  const newsletter = await testSubscription(
    args.baseUrl,
    "/api/newsletter",
    "newsletter_subscribers",
    "verify-script",
    "Newsletter signup",
  );

  const waitlist = await testSubscription(
    args.baseUrl,
    "/api/cashback-waitlist",
    "cashback_waitlist",
    "verify-script",
    "Cashback waitlist signup",
  );

  const results = [newsletter, waitlist];

  for (const r of results) {
    console.log(`── ${r.flow} ──`);
    for (const d of r.details) console.log(`   ${d}`);
    if (r.status === "PASS") {
      console.log(`   ✓ PASS`);
    } else {
      console.log(`   ✗ FAIL: ${r.failure}`);
    }
    console.log();
  }

  const allPass = results.every((r) => r.status === "PASS");
  if (allPass) {
    console.log(`✓ All subscription flows verified end-to-end`);
    process.exit(0);
  } else {
    console.log(`✗ One or more flows failed — investigate above`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
