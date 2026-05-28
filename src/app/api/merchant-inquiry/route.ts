/* /api/merchant-inquiry — capture retailer applications from the
   /for-merchants form.

   POST shape mirrors the MerchantInquiryForm fields. Persists to
   merchant_inquiries (migration 0057), fires a confirmation to the
   applicant, and pings hello@havlo.io so the team gets
   notified without polling the dashboard.

   Failure-tolerance mirrors /api/notify-product and /api/alerts:
   missing migration → return ok:true so the form's success state
   still renders during rollout. */

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { sendEmail } from "@/lib/email/send";
import {
  merchantInquiryConfirmation,
  merchantInquiryInternalNotification,
} from "@/lib/email/templates/merchant-inquiry";

interface InquiryRequest {
  storeName?:   string;
  contactName?: string;
  email?:       string;
  storeUrl?:    string;
  feedUrl?:     string;
  countries?:   string;
  skuCount?:    string;
  notes?:       string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE   = /^https?:\/\/.+/i;
const MAX_LEN  = 2000;

const PARTNERSHIPS_INBOX = process.env.PARTNERSHIPS_INBOX?.trim() || "hello@havlo.io";

function clean(s: string | undefined, max = MAX_LEN): string | null {
  const t = s?.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: InquiryRequest;
  try {
    body = (await req.json()) as InquiryRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const storeName   = clean(body.storeName, 200);
  const contactName = clean(body.contactName, 120);
  const email       = clean(body.email, 200)?.toLowerCase();
  const storeUrl    = clean(body.storeUrl, 500);
  const feedUrl     = clean(body.feedUrl, 500);
  const countries   = clean(body.countries, 200)?.toLowerCase() ?? null;
  const skuCount    = clean(body.skuCount, 50);
  const notes       = clean(body.notes, 4000);

  if (!storeName || storeName.length < 2) {
    return NextResponse.json({ ok: false, error: "Store name required" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }
  if (!storeUrl || !URL_RE.test(storeUrl)) {
    return NextResponse.json({ ok: false, error: "Valid store URL required" }, { status: 400 });
  }
  if (feedUrl && !URL_RE.test(feedUrl)) {
    return NextResponse.json({ ok: false, error: "Feed URL must be http(s)" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) {
    return NextResponse.json({ ok: true, note: "DB not configured; inquiry not persisted" });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const { error } = await supa
    .from("merchant_inquiries")
    .upsert(
      {
        store_name:   storeName,
        contact_name: contactName,
        email,
        store_url:    storeUrl,
        feed_url:     feedUrl,
        countries,
        sku_count:    skuCount,
        notes,
        user_agent:   userAgent,
      },
      { onConflict: "email,store_url", ignoreDuplicates: true },
    );

  if (error) {
    if (/relation .* does not exist|could not find the table.*in the schema cache/i.test(error.message)) {
      console.warn("[merchant-inquiry] table not yet migrated:", error.message);
      return NextResponse.json({ ok: true, note: "Table pending migration" });
    }
    console.error("[merchant-inquiry] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save inquiry" }, { status: 500 });
  }

  /* Confirmation to the applicant + internal ping. Both via waitUntil
     so neither can slow the form's success render. */
  const confirmationTmpl = merchantInquiryConfirmation({ storeName });
  const notifyTmpl = merchantInquiryInternalNotification({
    storeName, email, contactName,
    storeUrl, feedUrl, countries, skuCount, notes,
  });

  waitUntil(
    sendEmail({
      to:      email,
      subject: confirmationTmpl.subject,
      text:    confirmationTmpl.text,
      html:    confirmationTmpl.html,
      tags: [{ name: "category", value: "merchant-inquiry-confirmation" }],
    }).catch((err) => {
      console.error("[merchant-inquiry] confirmation email failed:", (err as Error).message);
    }),
  );

  waitUntil(
    sendEmail({
      to:      PARTNERSHIPS_INBOX,
      subject: notifyTmpl.subject,
      text:    notifyTmpl.text,
      html:    notifyTmpl.html,
      replyTo: email,
      tags: [{ name: "category", value: "merchant-inquiry-internal" }],
    }).catch((err) => {
      console.error("[merchant-inquiry] internal notification failed:", (err as Error).message);
    }),
  );

  return NextResponse.json({ ok: true });
}
