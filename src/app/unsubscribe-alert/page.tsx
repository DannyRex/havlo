/* /unsubscribe-alert — price-alert removal, TWO-STEP (GET renders a
   confirmation, the button POSTs the removal).

   WHY two steps: cancelling an alert DELETEs a row, so it must NEVER run
   on a GET (RFC 9110: GET is "safe"). Inbox link scanners / prefetchers
   (Gmail, Outlook Safe Links, Mimecast, corporate proxies) crawl every
   url in an email, including this link in the alert footer. The previous
   version deleted on page load, so those bots silently destroyed users'
   alerts — and unlike the newsletter (a status flip), a DELETE can't be
   restored. Now the GET only renders a confirm button; the delete happens
   in a server action (POST), which link crawlers don't trigger.

   Token possession = auth (the row's `token` column is a random UUID; the
   user got it by being the addressee). ~10^36 namespace, brute-force
   infeasible. Verified on the GET render AND inside the server action. */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

interface PageProps {
  searchParams: { token?: string; done?: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/* Server action — POST only, so GET-issuing link scanners can't reach it.
   Re-validates the token before the delete, then PRG-redirects to ?done=1
   so a refresh / back can't re-run it. */
async function confirmCancelAlert(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "").trim();
  if (!UUID_RE.test(token)) {
    redirect("/");
  }
  const supa = getSupabaseAdmin();
  if (supa) {
    /* DELETE by token. PostgREST returns no error on a 0-row match, so
       "already cancelled" and "valid token" both land on success. */
    await supa.from("price_alerts").delete().eq("token", token);
  }
  redirect(`/unsubscribe-alert?token=${encodeURIComponent(token)}&done=1`);
}

export default async function UnsubscribeAlertPage({ searchParams }: PageProps) {
  const token = (searchParams.token ?? "").trim();
  if (!token || !UUID_RE.test(token)) {
    /* Malformed token — bounce home so we don't reveal whether the token
       namespace is valid. Defence-in-depth against probing. */
    redirect("/");
  }

  /* Success state, reached only after the server action ran (PRG). No
     mutation here, so a crawler hitting ?done is harmless. */
  if (searchParams.done === "1") {
    return (
      <main className="bg-bg min-h-[60vh]">
        <section className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="inline-flex w-14 h-14 rounded-full bg-success/10 items-center justify-center mb-5">
            <Check size={28} className="text-success" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-[-0.02em] mb-3">
            Alert cancelled
          </h1>
          <p className="text-ink-2 text-[15px] leading-relaxed mb-8">
            You won&apos;t get any more emails about this product&apos;s price.
            You can set up a new alert any time from the product page.
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

  /* GET: confirmation only. No delete happens here — the button submits
     the server action above. */
  return (
    <main className="bg-bg min-h-[60vh]">
      <section className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-[-0.02em] mb-3">
          Cancel this price alert?
        </h1>
        <p className="text-ink-2 text-[15px] leading-relaxed mb-8">
          Confirm below and we&apos;ll stop emailing you about this product&apos;s
          price. You can set up a new alert any time from the product page.
        </p>
        <form action={confirmCancelAlert}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Yes, cancel this alert
          </button>
        </form>
        <div className="mt-4">
          <Link
            href="/"
            className="text-ink-3 text-sm hover:text-ink underline underline-offset-4"
          >
            No, keep the alert
          </Link>
        </div>
      </section>
    </main>
  );
}
