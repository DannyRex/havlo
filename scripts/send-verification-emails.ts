#!/usr/bin/env tsx
/* Fires all three transactional-email signups with a real address so
   you can verify the brand-voice content in your inbox before launch.

   Triggers (all use waitUntil so emails fire immediately):
     1. /api/newsletter        → newsletter-welcome email
     2. /api/cashback-waitlist → cashback-waitlist email
     3. /api/notify-product    → notify-product confirmation

   Usage:
     npx tsx --tsconfig tsconfig.scripts.json scripts/send-verification-emails.ts
     npx tsx --tsconfig tsconfig.scripts.json scripts/send-verification-emails.ts --email=other@example.com
     npx tsx --tsconfig tsconfig.scripts.json scripts/send-verification-emails.ts --base-url=http://localhost:3000

   Defaults to production havlo.io with ekumdaniel@gmail.com.

   Side effects — these are REAL signups against production. Each leaves
   a row in the corresponding table:
     - newsletter_subscribers   (source = "verify-content")
     - cashback_waitlist        (source = "verify-content")
     - product_requests         (source = "verify-content")
   Pass --cleanup to delete rows tagged source="verify-content" after
   running, so repeat runs don't accumulate. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {/* ok */}
import { getSupabaseAdmin } from "../src/lib/providers/db-client";

interface Args {
  baseUrl: string;
  email:   string;
  cleanup: boolean;
}

function parseArgs(): Args {
  let baseUrl = "https://havlo.io";
  let email   = "ekumdaniel@gmail.com";
  let cleanup = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--base-url=")) baseUrl = arg.slice("--base-url=".length);
    else if (arg.startsWith("--email=")) email = arg.slice("--email=".length);
    else if (arg === "--cleanup") cleanup = true;
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), email, cleanup };
}

interface Result {
  flow:       string;
  endpoint:   string;
  status:     "SENT" | "FAILED";
  detail:     string;
  expectedSubject?: string;
}

async function fire(opts: {
  baseUrl:  string;
  endpoint: string;
  body:     Record<string, unknown>;
  flow:     string;
  expectedSubject: string;
}): Promise<Result> {
  try {
    const res = await fetch(`${opts.baseUrl}${opts.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts.body),
    });
    const txt = await res.text();
    if (!res.ok) {
      return {
        flow: opts.flow, endpoint: opts.endpoint, status: "FAILED",
        detail: `HTTP ${res.status} — ${txt.slice(0, 200)}`,
      };
    }
    let parsed: { ok?: boolean; error?: string; note?: string };
    try { parsed = JSON.parse(txt); } catch {
      return {
        flow: opts.flow, endpoint: opts.endpoint, status: "FAILED",
        detail: `non-JSON response: ${txt.slice(0, 200)}`,
      };
    }
    if (!parsed.ok) {
      return {
        flow: opts.flow, endpoint: opts.endpoint, status: "FAILED",
        detail: parsed.error ?? "ok:false",
      };
    }
    /* The route returns ok:true with a "note" when the migration
       isn't applied yet — the form still shows success but the row
       doesn't actually persist and the email DOES still fire. Flag
       it so the user knows. */
    const noteHint = parsed.note ? ` (note: ${parsed.note})` : "";
    return {
      flow: opts.flow, endpoint: opts.endpoint, status: "SENT",
      detail: `HTTP 200 ok:true${noteHint}`,
      expectedSubject: opts.expectedSubject,
    };
  } catch (err) {
    return {
      flow: opts.flow, endpoint: opts.endpoint, status: "FAILED",
      detail: `fetch error: ${(err as Error).message}`,
    };
  }
}

async function cleanupRows() {
  const supa = getSupabaseAdmin();
  if (!supa) {
    console.log("⚠ Skipping cleanup — Supabase admin client unavailable");
    return;
  }
  const tables = ["newsletter_subscribers", "cashback_waitlist", "product_requests"];
  for (const t of tables) {
    const { error, count } = await supa.from(t).delete({ count: "exact" }).eq("source", "verify-content");
    if (error) {
      /* Pre-migration tables don't exist yet — fail soft. */
      console.log(`   ${t}: (skipped — ${error.message})`);
    } else {
      console.log(`   ${t}: removed ${count ?? 0} row(s)`);
    }
  }
}

async function main() {
  const args = parseArgs();
  console.log(`▶ Firing all three subscription flows`);
  console.log(`  baseUrl: ${args.baseUrl}`);
  console.log(`  email:   ${args.email}`);
  console.log(`  cleanup: ${args.cleanup ? "yes (post-run)" : "no"}\n`);

  const results: Result[] = [];

  /* Country defaults to NG so the templates use NG-specific URLs
     (e.g. dealsUrl = https://havlo.io/ng/deals). Override the
     country in the script if you want to verify the UK / etc. variant. */
  const country = "ng";
  const source  = "verify-content";

  results.push(await fire({
    baseUrl: args.baseUrl,
    endpoint: "/api/newsletter",
    flow: "Newsletter welcome",
    expectedSubject: "You're in. The first Havlo digest lands soon.",
    body: { email: args.email, country, source },
  }));

  results.push(await fire({
    baseUrl: args.baseUrl,
    endpoint: "/api/cashback-waitlist",
    flow: "Cashback waitlist confirmation",
    expectedSubject: "You're on the cashback list",
    body: { email: args.email, country, source },
  }));

  results.push(await fire({
    baseUrl: args.baseUrl,
    endpoint: "/api/notify-product",
    flow: "Notify-product confirmation",
    /* Subject pulled from notifyProductConfirmation(). Update if the
       template changes — kept here only as a hint of what to look for. */
    expectedSubject: "We'll watch for that product",
    body: { email: args.email, country, source, query: "iPhone 17 Pro" },
  }));

  for (const r of results) {
    console.log(`── ${r.flow} ──`);
    console.log(`   POST ${r.endpoint}`);
    if (r.status === "SENT") {
      console.log(`   ✓ ${r.detail}`);
      if (r.expectedSubject) console.log(`     expected subject: "${r.expectedSubject}"`);
    } else {
      console.log(`   ✗ ${r.detail}`);
    }
    console.log();
  }

  if (args.cleanup) {
    console.log(`▶ Cleaning up rows tagged source="${source}"`);
    await cleanupRows();
    console.log();
  }

  console.log(`Done. Check ${args.email} for 3 emails. The send happens via Resend with`);
  console.log(`waitUntil() so it's non-blocking — emails typically arrive within 5-30s.`);
  console.log(`If any are missing, check Resend's logs for the corresponding send.`);
}
main().catch((e) => { console.error("✗ unexpected error:", e); process.exit(1); });
