/* /unsubscribe-newsletter — one-click newsletter removal page.

   Linked from the footer of every digest email. Auth is the HMAC
   signature over the subscriber's email (src/lib/email/unsubscribe-
   token.ts): the user got the valid (e, sig) pair by being the
   addressee, the same possession-is-auth posture as /unsubscribe-alert.
   Flips every newsletter_subscribers row for the address to
   'unsubscribed' server-side, then renders a confirmation.

   No login required. When the rows are already gone (clicked twice,
   one-clicked via the header first) we still render success so the UX
   stays friendly. A bad / missing signature bounces to the homepage so
   we never reveal whether an address is on the list. */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { verifyUnsubscribe, normalizeEmail } from "@/lib/email/unsubscribe-token";

interface PageProps {
  searchParams: { e?: string; sig?: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = "force-dynamic";

export default async function UnsubscribeNewsletterPage({ searchParams }: PageProps) {
  const email = normalizeEmail(searchParams.e ?? "");
  const sig = searchParams.sig?.trim();

  if (!email || !EMAIL_RE.test(email) || !verifyUnsubscribe(email, sig)) {
    /* Malformed / forged link — bounce home without confirming whether
       the address is a subscriber. Defence-in-depth against probing. */
    redirect("/");
  }

  const supa = getSupabaseAdmin();
  if (supa) {
    /* UPDATE by email. PostgREST returns no error on a 0-row match, so
       we can't (and shouldn't) distinguish "already unsubscribed" from
       a fresh removal — both land on the success state below. */
    await supa
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed" })
      .eq("email", email);
  }

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
