/* /api/newsletter — daily deals digest subscription endpoint.

   Replaces the mailto: fallback that EmailCapture used when
   NEXT_PUBLIC_NEWSLETTER_FORM_URL was unset (every visitor saw their
   mail app open instead of the success state). Saves signups into
   the newsletter_subscribers table + sends a welcome email via Resend.

   Mirrors /api/cashback-waitlist and /api/notify-product:
     • Accepts JSON {email, source?, country?}
     • Validates email format
     • Upserts on (email, source) so re-submission is a no-op
     • Sends welcome email via waitUntil (non-blocking)
     • Fails soft when the table isn't migrated yet — UX preserved

   Database table: newsletter_subscribers (see scripts/db/0009-…).
   Migration must be applied before persistence works. Pre-migration
   the route returns ok:true and the welcome email still sends. */

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { unsubscribeLink } from "@/lib/email/unsubscribe-token";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { sendEmail } from "@/lib/email/send";
import { newsletterWelcome } from "@/lib/email/templates/newsletter-welcome";

interface NewsletterRequest {
  email?:    string;
  source?:   string;
  country?:  string;
  /* Optional category slug — when set, the subscriber gets only the
     daily digest items in this category (Phones, Audio, Computing,
     etc.) instead of the cross-category roundup. Empty / missing /
     "all" means the standard catch-all newsletter. */
  category?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: NewsletterRequest;
  try {
    body = (await req.json()) as NewsletterRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const email   = body.email?.trim().toLowerCase();
  const country = body.country?.trim().toLowerCase() ?? null;
  const source  = body.source?.trim() || "homepage";
  /* Normalise category — empty string / "all" / unrecognised values
     all become null so the newsletter sender treats them as the
     catch-all roundup. The send pipeline (Phase 2) will branch on
     this column to filter the digest. */
  const rawCat  = body.category?.trim().toLowerCase();
  const category = rawCat && rawCat !== "all" ? rawCat : null;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (supa) {
    const { error } = await supa
      .from("newsletter_subscribers")
      .upsert(
        /* category column added in migration 0014. Pre-migration the
           upsert silently drops the unknown column via PostgREST and
           falls back to the catch-all behaviour — fail-soft. */
        { email, source, country, category, status: "active" },
        { onConflict: "email,source", ignoreDuplicates: true },
      );

    if (error) {
      /* Match both Postgres-native and PostgREST schema-cache errors —
         either means the migration hasn't been applied. Fail soft so
         the user-facing form still shows success during rollout. */
      if (/relation .* does not exist|could not find the table.*in the schema cache/i.test(error.message)) {
        console.warn("[newsletter] table not yet migrated:", error.message);
      } else if (/no unique or exclusion constraint/i.test(error.message)) {
        console.error("[newsletter] index/constraint mismatch:", error.message);
        return NextResponse.json(
          { ok: false, error: "Server config issue. We've been alerted." },
          { status: 500 },
        );
      } else {
        console.error("[newsletter] insert error:", error.message);
        return NextResponse.json({ ok: false, error: "Could not save signup" }, { status: 500 });
      }
    }
  }

  /* Welcome email — fire-and-forget via waitUntil so the user
     response isn't gated on Resend latency. */
  const tmpl = newsletterWelcome({ country, unsubscribeUrl: unsubscribeLink(email) });
  waitUntil(
    sendEmail({
      to:      email,
      subject: tmpl.subject,
      text:    tmpl.text,
      html:    tmpl.html,
      tags: [
        { name: "category", value: "newsletter-welcome" },
        { name: "source",   value: source.replace(/[^a-z0-9_-]/gi, "_").slice(0, 50) },
      ],
    }).catch((err) => {
      console.error("[newsletter] welcome send failed:", (err as Error).message);
    }),
  );

  return NextResponse.json({ ok: true });
}
