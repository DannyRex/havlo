/* /api/cashback-waitlist — pre-launch email capture for the
   cashback program (Phase 1).

   Replaces the mailto: fallback on /[country]/cashback so signups
   land in the cashback_waitlist table where we can analyze them,
   email-blast at launch, and track conversion from waitlist to
   first cashback earner.

   Inserts are upsert-by (email, source) so re-submitting the same
   email from the same surface no-ops cleanly. Lets users hit
   submit without worrying about duplicates.

   Database table: cashback_waitlist (see scripts/db/0006-cashback-
   accounts.sql). Migration must be applied before this route works.
   When the table doesn't exist (pre-migration), the route returns
   ok:true anyway so the form's success state still lands and we
   don't break UX during the rollout window. */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

interface WaitlistRequest {
  email?:   string;
  country?: string;
  source?:  string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: WaitlistRequest;
  try {
    body = (await req.json()) as WaitlistRequest;
  } catch {
    /* Form-encoded fallback — the explainer page's <form> can post
       either JSON or form data. Parse form-encoded too. */
    try {
      const form = await req.formData();
      body = {
        email:   form.get("email")?.toString(),
        country: form.get("country")?.toString(),
        source:  form.get("source")?.toString(),
      };
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
  }

  const email   = body.email?.trim().toLowerCase();
  const country = body.country?.trim().toLowerCase() ?? null;
  const source  = body.source?.trim() || "cashback-page";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    /* DB not configured — accept anyway so user-facing UX works.
       Useful in local dev / preview deploys without Supabase keys. */
    return NextResponse.json({ ok: true, note: "DB not configured; signup not persisted" });
  }

  /* Upsert by (email, source) — re-submission of the same email from
     the same surface is a no-op rather than an error. */
  const { error } = await supa
    .from("cashback_waitlist")
    .upsert(
      { email, country, source },
      { onConflict: "email,source", ignoreDuplicates: true },
    );

  if (error) {
    /* Migration-not-applied case: table doesn't exist. Return ok:true
       so the user-facing form still shows success rather than a
       confusing error. The signup is effectively lost but UX is
       preserved during the rollout window. */
    if (/relation .* does not exist/i.test(error.message)) {
      console.warn("[cashback-waitlist] table not yet migrated:", error.message);
      return NextResponse.json({ ok: true, note: "Table pending migration" });
    }
    console.error("[cashback-waitlist] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save signup" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
