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

  const query   = body.query?.trim().slice(0, MAX_QUERY_LEN);
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
    if (/relation .* does not exist/i.test(error.message)) {
      console.warn("[notify-product] table not yet migrated:", error.message);
      return NextResponse.json({ ok: true, note: "Table pending migration" });
    }
    console.error("[notify-product] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save request" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
