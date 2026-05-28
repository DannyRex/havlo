/* /unsubscribe-alert — one-click alert removal page.

   Linked from every price-alert email's footer. Token possession =
   auth (the row's `token` column is a random UUID; the user got it
   by being the addressee). DELETEs the matching row server-side
   then renders a confirmation page.

   No login required. Same posture as standard email-unsubscribe
   conventions. The token is high-entropy random UUID, so the
   ENUM space is ~10^36 — brute-force is infeasible.

   When the row is already gone (user clicked twice, or alert was
   already fired and reset) we still render the success state so
   the UX is friendly. The "delete fails silently" branch is a
   deliberate UX call: pinging the user with an error when the
   end state is "you don't have this alert anymore" would be
   confusing. */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/providers/db-client";

interface PageProps {
  searchParams: { token?: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function UnsubscribeAlertPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  if (!token || !UUID_RE.test(token)) {
    /* Malformed token — bounce to homepage so we don't reveal whether
       the token namespace is valid. Defence-in-depth against probing. */
    redirect("/");
  }

  const supa = getSupabaseAdmin();
  if (supa) {
    /* DELETE by token. Returns no error when 0 rows match (PostgREST
       behaviour) so we can't distinguish "already unsubscribed" from
       "valid token" — and we shouldn't, per the comment above. */
    await supa.from("price_alerts").delete().eq("token", token);
  }

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
