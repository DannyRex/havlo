/* Per-country withdrawal minimums for the cashback program.

   Why this file exists: the cashback page used to hardcode
   `country.code === "ng" ? "₦5,000" : "$25"` inline, which (1) hid
   the policy in JSX, (2) wasn't accessible to other surfaces (email
   sequence, FAQ, dashboard), (3) defaulted every non-NG country to
   the US dollar minimum even when the local currency made more
   sense (£5 / €5 / AED 20 / ₹400 / R100 are all roughly $5
   equivalent and read more naturally to local shoppers).

   How the values were picked: rough $5 USD parity at May 2026 FX,
   rounded to clean local denominations. Low enough that a casual
   shopper hits the floor in 3 to 8 typical purchases × ~3% rate.
   Tuned to "feels reachable" rather than "covers the bank fee" —
   we eat the transfer cost in exchange for a low-friction first
   payout that builds trust.

   Update logic: refresh quarterly if FX moves more than ~15%, or
   when payment-rail fees change in a market. */

export type CashbackCountryCode = "ng" | "uk" | "us" | "ae" | "de" | "in" | "za";

export interface WithdrawalMin {
  /** Raw amount in local currency, for comparisons + math. */
  value:    number;
  /** ISO 4217 code, for downstream payment-rail integrations. */
  currency: string;
  /** Pre-formatted display string ("₦5,000", "$5", "AED 20"). UI
      reads this directly so we don't run Intl.NumberFormat in render. */
  display:  string;
}

export const CASHBACK_WITHDRAWAL_MIN: Record<CashbackCountryCode, WithdrawalMin> = {
  ng: { value: 5000, currency: "NGN", display: "₦5,000" },
  uk: { value: 5,    currency: "GBP", display: "£5"     },
  us: { value: 5,    currency: "USD", display: "$5"     },
  ae: { value: 20,   currency: "AED", display: "AED 20" },
  de: { value: 5,    currency: "EUR", display: "€5"     },
  in: { value: 400,  currency: "INR", display: "₹400"   },
  za: { value: 100,  currency: "ZAR", display: "R100"   },
};

/* Soft fallback to NG (Havlo's launch market) for any country code
   we haven't listed. Lets future country additions render without
   a 500 — they'll show the NG threshold until a row is added here. */
export function getWithdrawalMin(countryCode: string): WithdrawalMin {
  const key = countryCode.toLowerCase() as CashbackCountryCode;
  return CASHBACK_WITHDRAWAL_MIN[key] ?? CASHBACK_WITHDRAWAL_MIN.ng;
}
