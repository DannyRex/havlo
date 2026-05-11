/* Homepage newsletter strip — sits between StoreLogos and the final
   CTA panel. Centered, warm, low-friction.

   Why this position in the flow: by the time users get here they've
   seen what Havlo does (Hero), the deal inventory (TrendingDeals),
   the categories (CategoryGrid), and the store coverage (StoreLogos).
   They're either convinced (next step: CTA panel below) or curious
   (next step: subscribe to follow along). Email capture catches the
   second group before the final CTA's "convert now" pitch. */

import EmailCapture from "@/components/email/EmailCapture";

export default function NewsletterStrip() {
  return (
    <section className="py-12 sm:py-20 bg-surface border-y border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.12em] mb-3">
          Stay in the loop
        </p>
        <h2 className="text-[24px] sm:text-3xl font-bold text-ink tracking-[-0.025em] leading-tight mb-3 sm:mb-4">
          The best price drops, in your inbox.
        </h2>
        <p className="text-sm sm:text-base text-ink-2 max-w-md mx-auto mb-7 sm:mb-8 leading-relaxed">
          Two emails a week, Monday and Thursday morning. Just the price
          drops worth opening. Unsubscribe in one click.
        </p>
        <div className="flex justify-center">
          <EmailCapture heading="" subheading="" source="homepage-strip" />
        </div>
      </div>
    </section>
  );
}
