/* /unsubscribe-newsletter — newsletter removal, TWO-STEP (GET renders a
   confirmation, the button POSTs the removal).

   WHY two steps (this is a fix for a real incident): an unsubscribe is a
   state change, so it must NEVER run on a GET (RFC 9110: GET is "safe").
   Inbox link scanners and prefetchers — Gmail, Outlook Safe Links,
   Mimecast, corporate security proxies — crawl EVERY url in an email,
   including the unsubscribe link in the digest/welcome footer, within
   minutes of delivery. The previous version mutated on page load, so
   those bots silently unsubscribed real subscribers right after they
   signed up. The entire active list decayed to zero and the digest went
   out to nobody. Now the GET only renders a confirm button; the removal
   happens in a server action (POST), which link crawlers don't trigger.

   Auth is the HMAC (e, sig) pair (src/lib/email/unsubscribe-token.ts):
   possession proves the addressee. It is verified on BOTH the GET render
   AND again inside the server action before the write. A bad / missing
   signature bounces to the homepage so we never reveal list membership. */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { verifyUnsubscribe, normalizeEmail } from "@/lib/email/unsubscribe-token";

interface PageProps {
  searchParams: { e?: string; sig?: string; done?: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = "force-dynamic";

/* Server action — POST only, so inbox link scanners (which issue GET, and
   for List-Unsubscribe-Post a body-bearing POST, never a real form submit)
   can't reach it. Re-verifies the signature before the write, then
   PRG-redirects to ?done=1 so a refresh / back can't re-run the mutation. */
async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const email = normalizeEmail(String(formData.get("e") ?? ""));
  const sig = String(formData.get("sig") ?? "").trim();
  if (!email || !EMAIL_RE.test(email) || !verifyUnsubscribe(email, sig)) {
    redirect("/");
  }
  const supa = getSupabaseAdmin();
  if (supa) {
    /* Flip every (email, source) row for this address to 'unsubscribed'
       so one confirmation removes them from all signup surfaces at once.
       Idempotent; a 0-row match is fine. */
    await supa
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed" })
      .eq("email", email);
  }
  redirect(
    `/unsubscribe-newsletter?e=${encodeURIComponent(email)}&sig=${encodeURIComponent(sig)}&done=1`,
  );
}

export default async function UnsubscribeNewsletterPage({ searchParams }: PageProps) {
  const email = normalizeEmail(searchParams.e ?? "");
  const sig = (searchParams.sig ?? "").trim();

  if (!email || !EMAIL_RE.test(email) || !verifyUnsubscribe(email, sig)) {
    /* Malformed / forged link — bounce home without confirming whether
       the address is a subscriber. Defence-in-depth against probing. */
    redirect("/");
  }

  /* Success state, reached only after the server action ran (PRG). The
     ?done render itself performs NO mutation, so a crawler hitting it is
     harmless. */
  if (searchParams.done === "1") {
    return (
      <main className="bg-bg min-h-[60vh]">
        <section className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-success/10 items-center justify-center mb-5">
            <Check size={28} className="text-success" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-[-0.02em] mb-3">
            You&apos;re unsubscribed
          </h1>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-8">
            You won&apos;t get any more Havlo newsletter digests. You can resubscribe
            any time from the homepage if you change your mind.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Back to Havlo
          </Link>
        </section>
      </main>
    );
  }

  /* GET: confirmation only. No write happens here — the button submits the
     server action above. */
  return (
    <main className="bg-bg min-h-[60vh]">
      <section className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-[-0.02em] mb-3">
          Unsubscribe from Havlo deals?
        </h1>
        <p className="text-ink-2 text-[15px] leading-relaxed mb-8">
          Confirm below and <span className="text-ink font-medium">{email}</span> will
          stop receiving the deals digest. You can resubscribe any time from the homepage.
        </p>
        <form action={confirmUnsubscribe}>
          <input type="hidden" name="e" value={email} />
          <input type="hidden" name="sig" value={sig} />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Yes, unsubscribe me
          </button>
        </form>
        <div className="mt-4">
          <Link
            href="/"
            className="text-ink-3 text-sm hover:text-ink underline underline-offset-4"
          >
            No, keep me subscribed
          </Link>
        </div>
      </section>
    </main>
  );
}
