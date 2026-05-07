/* /api/notify-product — capture "tell me when Havlo finds X" requests
   from the empty-state recovery UI on /deals and /compare.

   Each row in product_requests is two things at once:
     1. A subscription — we email the user when their query starts
        returning matches (Phase 2; not wired yet).
     2. A demand signal — sort by query frequency to know what to
        prioritise for catalog ingestion.

   Mirrors /api/cashback-waitlist's failure-tolerance: when the
   product_requests table isn't migrated yet, the route still returns
   ok:true so the form shows success and the user-facing UX doesn't
   break during the rollout window. */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { sendEmail } from "@/lib/email/send";
import { notifyProductConfirmation } from "@/lib/email/templates/notify-product";

interface NotifyRequest {
  query?:   string;
  email?:   string;
  country?: string;
  source?:  string;  // 'deals' | 'compare'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QUERY_LEN = 200;

export async function POST(req: NextRequest) {
  let body: NotifyRequest;
  try {
    body = (await req.json()) as NotifyRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  /* Lowercase BOTH email and query so the (email, query) unique index
     dedups across casing. "iPhone 15 Pro" and "iphone 15 pro" should
     count as the same demand signal — different casing is a typo
     story, not different products. */
  const query   = body.query?.trim().slice(0, MAX_QUERY_LEN).toLowerCase();
  const email   = body.email?.trim().toLowerCase();
  const country = body.country?.trim().toLowerCase() ?? null;
  const source  = body.source?.trim() || "unknown";

  if (!query || query.length < 2) {
    return NextResponse.json({ ok: false, error: "Query is required" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    /* DB not configured — accept gracefully so the form's success
       state still lands. Lost in dev/preview but UX preserved. */
    return NextResponse.json({ ok: true, note: "DB not configured; request not persisted" });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  /* Upsert by (email, query) — re-submitting the same combo no-ops. */
  const { error } = await supa
    .from("product_requests")
    .upsert(
      { query, email, country, source, user_agent: userAgent },
      { onConflict: "email,query", ignoreDuplicates: true },
    );

  if (error) {
    /* Match both Postgres-native errors ('relation X does not exist')
       AND PostgREST's schema-cache-miss errors ('Could not find the
       table X in the schema cache'). Either means the migration
       hasn't been applied yet — fail soft so the user-facing form
       still shows success during the rollout window. */
    if (/relation .* does not exist|could not find the table.*in the schema cache/i.test(error.message)) {
      console.warn("[notify-product] table not yet migrated:", error.message);
      return NextResponse.json({ ok: true, note: "Table pending migration" });
    }
    /* Constraint-mismatch is a config bug worth flagging loudly so it
       gets fixed instead of silently dropping signups. */
    if (/no unique or exclusion constraint/i.test(error.message)) {
      console.error("[notify-product] index/constraint mismatch:", error.message);
      return NextResponse.json(
        { ok: false, error: "Server config issue. We've been alerted." },
        { status: 500 },
      );
    }
    console.error("[notify-product] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save request" }, { status: 500 });
  }

  /* Send confirmation email. Awaited (Resend is sub-200ms typical) but
     failures are non-blocking — the row is already saved, the email is
     a nice-to-have. Logged in sendEmail() if it fails. Tagged so the
     Resend dashboard can filter / report on confirmation volume. */
  const tmpl = notifyProductConfirmation({ query, country });
  await sendEmail({
    to:      email,
    subject: tmpl.subject,
    text:    tmpl.text,
    html:    tmpl.html,
    tags: [
      { name: "category", value: "notify-confirmation" },
      { name: "source",   value: source.replace(/[^a-z0-9_-]/gi, "_").slice(0, 50) },
    ],
  });

  return NextResponse.json({ ok: true });
}
