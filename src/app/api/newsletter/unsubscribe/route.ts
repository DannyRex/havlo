/* /api/newsletter/unsubscribe — RFC 8058 one-click unsubscribe.

   The https target inside every digest's List-Unsubscribe header. The
   subscriber's mailbox provider (Gmail / Apple Mail / Yahoo) POSTs here
   when they tap the native "Unsubscribe" control, with no body and no
   session — possession of the signed (e, sig) pair IS the authorisation
   (see src/lib/email/unsubscribe-token.ts).

   POST only. The human-visible link in the email BODY points instead at
   the branded /unsubscribe-newsletter page; this route exists purely for
   the mailbox one-click flow. Always answers 200 on a valid signature
   (even when 0 rows match, i.e. already unsubscribed) so providers mark
   the unsubscribe as honoured and stop offering it. */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { verifyUnsubscribe, normalizeEmail } from "@/lib/email/unsubscribe-token";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const email = normalizeEmail(url.searchParams.get("e") ?? "");
  const sig = url.searchParams.get("sig");

  if (!email || !EMAIL_RE.test(email) || !verifyUnsubscribe(email, sig)) {
    /* Invalid or forged link. 400, no detail — don't confirm whether the
       address exists on the list. */
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (supa) {
    /* Flip every (email, source) row for this address to 'unsubscribed'
       so one click removes them from all signup surfaces at once. The
       send pipeline filters status='active', so this fully stops the
       digest. Idempotent; a 0-row match still returns ok. */
    await supa
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed" })
      .eq("email", email);
  }

  return new NextResponse("You have been unsubscribed from the Havlo newsletter.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
