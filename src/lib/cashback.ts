/* Cashback rates — Phase 1: display-only.

   Phase 1 surfaces "Earn X% cashback" badges on deal cards and an
   /[country]/cashback explainer page that captures email signups for
   the upcoming Phase 2 launch (real accounts + payouts).

   Rate map:
     - Per-store baseline (e.g. Amazon: 2%, Konga: 3%)
     - Multipliers / overrides could land per-category in a follow-up
       (e.g. Amazon Beauty pays Havlo 6-10% so user share could be
       higher there)

   The displayed rate is what we'll PAY on confirmed purchases. We
   keep a meaningful margin (typically 50-60% of the gross commission)
   to fund operations, payout fees, fraud reserve, and customer
   support. Don't bump these without re-running the unit economics. */

export interface CashbackRate {
  /** Percent shown on the badge (e.g. 2 means 2%). */
  percent: number;
  /** Human label for the explainer page. */
  storeLabel: string;
}

/* Match by storeId. Stores that don't appear here get NO badge —
   we only promote cashback for partners we have an active affiliate
   relationship with (live tag set in env vars). */
const RATES: Record<string, CashbackRate> = {
  /* Amazon — gross commission ranges 3-10% by category. Conservative
     2% user share keeps us margin-positive on lowest-paying categories
     (electronics) while still feeling meaningful to users. */
  "amazon":           { percent: 2, storeLabel: "Amazon" },
  "amazon-co-uk":     { percent: 2, storeLabel: "Amazon UK" },
  "amazon-de":        { percent: 2, storeLabel: "Amazon DE" },
  "amazon-ae":        { percent: 2, storeLabel: "Amazon AE" },
  "amazon-in":        { percent: 2, storeLabel: "Amazon IN" },

  /* Konga — affiliate is live but the gross commission rate
     doesn't leave enough margin to share with users while keeping
     payout + fraud reserve viable. Re-evaluate when their tier
     structure changes or when category-specific overrides land. */

  /* AliExpress — high gross rates (5-50% by category) so we can
     afford the headline 'up to 5%' user share. Activates with
     ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET. Bumped 4% → 5% in
     coordination with the site-wide 'Earn up to 5%' copy: the
     headline claim has to be true, and AliExpress's gross
     commission comfortably supports it. */
  "aliexpress":       { percent: 5, storeLabel: "AliExpress" },
};

/** Look up the cashback rate for a store. Returns null when there's
 *  no active rate (no badge shown). Case-insensitive match on storeId. */
export function getCashbackForStore(storeId: string): CashbackRate | null {
  const lc = storeId.toLowerCase().trim();
  return RATES[lc] ?? null;
}

/** All currently-configured rates, sorted highest first. Used by the
 *  /cashback explainer page to render the rate table. */
export function getAllCashbackRates(): CashbackRate[] {
  return Object.values(RATES).sort((a, b) => b.percent - a.percent);
}
