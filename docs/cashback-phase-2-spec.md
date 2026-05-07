# Cashback Phase 2 — Architecture & Implementation Spec

**Status:** draft, pre-implementation
**Phase 1 (shipped):** waitlist + display-only badges on deal cards
**Phase 2 (this doc):** real accounts + tracked clicks + balance ledger + payouts

## Goal

Take Havlo from "we'll tell you what cashback would be worth" to "click through Havlo, get money in your account 60-90 days later." This is the foundational user-account feature for the platform — once it ships, every other personalisation feature (saved searches, price alerts, watchlists) sits on the same auth.

## Why now (and why not earlier)

Phase 1 was right to ship as display-only. It validated:
- Users actually notice the badges (cashback_badge_click events firing)
- Visual treatment doesn't read as paid promotion
- The "coming soon" framing didn't kill trust

Phase 2 is the build-out. Doing it before Phase 1 would have meant building auth + a ledger before knowing if anyone wanted the feature.

## High-level flow

```
1. Visitor lands on Havlo
2. (anonymous) Clicks an Earn-N% deal card
3. We redirect via /api/go/cb/:click_id, log the click_id, then 302 to merchant
4. Merchant fires their affiliate postback to our /api/cashback/postback endpoint
5. We match the postback to the click_id, attribute to the user (if signed in)
   or hold it as orphan-pending (if anonymous)
6. After merchant's confirm window (typically 60-90 days), pending → confirmed
7. User sees confirmed balance in their dashboard
8. User requests payout (bank transfer for NG, Stripe Connect / PayPal for US/UK)
```

## What we need to build

### 1. Authentication

**Decision: Supabase Auth.**

Reasons:
- We already use Supabase for Postgres
- Supabase Auth is RLS-aware so the existing tables can simply add owner columns
- Magic-link email is enough for v1 (no passwords to store, no SMS budget)
- Social sign-in (Google) can be added in 30 minutes when needed

**NOT building:**
- Custom auth (rolling our own = security debt)
- Auth0 / Clerk (extra vendor + monthly cost without enough features to justify)
- SMS OTP (cost + Nigeria SIM-swap risk; revisit post-launch)

**Surfaces:**
- `/sign-in` — email input + magic link send
- `/sign-in/verify` — link target that exchanges token for session
- `/account` — protected dashboard

### 2. Click attribution

**The hard problem.** Most affiliate networks send postbacks asynchronously, sometimes with no user identifier — just an order total + a sub_id we set on the click.

**Approach: `click_id` UUID per outbound click.**

```sql
CREATE TABLE cashback_clicks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id),  -- null when anonymous
  store_id        text NOT NULL REFERENCES stores(id),
  product_id      uuid REFERENCES products(id),
  source_url      text,                            -- where they clicked from
  expected_rate   numeric(4,2) NOT NULL,           -- the % shown on the badge
  user_agent      text,
  ip_hash         text,                            -- for fraud correlation
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX cashback_clicks_user ON cashback_clicks(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX cashback_clicks_created ON cashback_clicks(created_at);
```

**The `/api/go/cb/:click_id` flow:**

1. User clicks an `Earn N%` deal
2. Server-side: insert into `cashback_clicks`, get the UUID
3. Wrap the merchant URL with the affiliate sub_id = our click_id
4. 302 to the wrapped URL

The click_id round-trips through the merchant via the affiliate network's sub_id parameter, so when the conversion postback arrives we can match it.

**Anonymous click handling:** if the user wasn't signed in at click time, `user_id` is null. When they sign in later, we attempt a best-effort backfill via cookie + ip_hash within a 30-day window. Conservative — better to lose some attribution than mis-attribute another user's earnings.

### 3. Conversion postbacks

```sql
CREATE TABLE cashback_conversions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id        uuid REFERENCES cashback_clicks(id),
  user_id         uuid REFERENCES auth.users(id),
  store_id        text NOT NULL,
  order_id        text,                            -- merchant's order ref
  order_total     numeric(10,2) NOT NULL,
  order_currency  text NOT NULL,
  cashback_amount numeric(10,2) NOT NULL,          -- post-rate, in order_currency
  cashback_ngn    numeric(10,2),                   -- normalized for NG users
  status          text NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected | paid
  confirmed_at    timestamptz,
  rejected_reason text,
  raw_postback    jsonb,                           -- full original payload
  created_at      timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX cashback_conversions_dedup ON cashback_conversions(store_id, order_id);
```

**The postback endpoint** `/api/cashback/postback` validates HMAC sig per network (each affiliate network signs differently), looks up the click_id, computes our take-rate vs the user's promised rate (Havlo keeps a margin — see Economics below), and writes the conversion row.

**Status lifecycle:**
- `pending` — postback received, within merchant's confirm window
- `confirmed` — passed the window without being rejected
- `rejected` — merchant declined (returns, fraud, charge-back)
- `paid` — funds withdrawn from balance

### 4. Balance ledger

Don't compute balance on every read. Materialise into a per-user balance table:

```sql
CREATE TABLE cashback_balances (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id),
  pending_ngn     numeric(10,2) DEFAULT 0,
  confirmed_ngn   numeric(10,2) DEFAULT 0,
  paid_ngn        numeric(10,2) DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);
```

Updated via Postgres triggers when `cashback_conversions.status` changes. Single row per user — point lookups stay O(1) for the dashboard.

### 5. Withdrawal flow

**Threshold:** ₦5,000 minimum (matches the Phase 1 trust card copy).

**Surfaces:**
- `/account/withdraw` — input bank details (account number + bank), submit
- Server-side: validate against the user's `confirmed_ngn` balance, create a `cashback_payouts` row with status `requested`
- Manual approval queue for v1 (operator runs the actual transfers)
- Status updates `requested → processing → paid` or `requested → rejected`

**Payment rails:**
- **NG**: Paystack Transfer API or Flutterwave — pick whichever has cheaper per-transfer fee at launch volume
- **US**: Stripe Connect Express
- **UK**: Stripe Connect Express
- **Other markets**: defer until volume justifies

**KYC:** for v1 require BVN match for NG users above the ₦20,000 cumulative-paid threshold. Below that, account-number match is enough. Skipping BVN for first-time small payouts removes the major friction point and the fraud window stays small.

## Economics

The promised rate to users (e.g. "Earn 5%") is LESS than the rate Havlo earns from the merchant (e.g. 7%). The 2-point spread is Havlo's margin. Standard for cashback platforms; users understand we're not charity.

Per-store rate setup goes in `lib/cashback.ts` (already exists for Phase 1 display). Phase 2 needs the dual-rate version:

```ts
interface CashbackRate {
  storeId: string;
  /** What we show users on the badge. */
  user_percent: number;
  /** What we actually earn from the network. Used for payout math. */
  network_percent: number;
  /** Honoured currency (we pay in NGN regardless). */
  network_currency: "USD" | "NGN" | "GBP";
}
```

## Build sequence (sprint plan)

**Sprint 1 — Auth + click logging (1.5 weeks)**
- Supabase Auth wired
- `/sign-in`, `/sign-in/verify`, `/account` shell
- `cashback_clicks` table + `/api/go/cb/:click_id` route
- All deal cards route through the new wrapper
- Migrations: `0012-cashback-clicks.sql`

**Sprint 2 — Conversion postbacks + ledger (1.5 weeks)**
- `cashback_conversions` table + per-network postback handlers
  - Awin (UK + EU)
  - Skimlinks (already wired in chrome — they have the conversion data)
  - Konga affiliate (NG)
  - Amazon Associates (when you cross 10 sales)
- `cashback_balances` materialised view + triggers
- Operator dashboard (manual confirm/reject) at `/admin/cashback`

**Sprint 3 — Withdrawal flow (1 week)**
- `cashback_payouts` table
- `/account/withdraw` form
- Paystack Transfer API integration for NG
- Operator approval queue
- Payout email confirmations via Resend

**Sprint 4 — Polish + KYC (0.5 week)**
- BVN check for NG users above threshold
- Email verification banner if not verified
- Account-deletion flow (GDPR / NDPR compliance)

**Total: ~4.5 weeks** of focused work for v1.

## Open questions for product

1. **Cashback for cross-border purchases?** Most affiliate networks pay only for completed orders, but cross-border ones may take 30-90 days to clear customs. If user clicks via Havlo, buys on Amazon US, and the order sits in customs for 60 days, we want the postback to clear in our window. Confirm with each network.

2. **Refunded orders?** If user gets a refund 30 days post-order, the merchant claws back the affiliate commission. Our cashback row should auto-flip to `rejected`. The operator dashboard needs a refund-handling action.

3. **Multi-merchant orders?** Some networks (Skimlinks) report a single postback for an order across multiple merchants. Need to split correctly.

4. **First-purchase bonus?** Lots of cashback platforms do "+₦1000 on your first qualifying purchase" to break the ice. Evaluate whether to bake this in v1 or defer.

5. **Referral programme?** Phase 3, not Phase 2. Don't bake referral logic into the v1 ledger schema, but leave room (`referrer_user_id` column ready to add).

## Risk register

- **Postback reliability**: networks sometimes lose postbacks. Mitigation: weekly reconciliation script that pulls each network's API for confirmed orders and fills gaps.
- **Click fraud**: bots clicking through Havlo to inflate "engagement" metrics. Mitigation: ip_hash + user_agent rate-limiting + invisible reCAPTCHA on the click endpoint.
- **Affiliate disqualification**: if Havlo violates a network's TOS (cookie stuffing, fake traffic, etc.), the network can void earnings retroactively. Mitigation: legal review of TOS before going live + clean traffic only.
- **Currency volatility**: confirmed-but-unpaid balances are vulnerable to NGN devaluation. Mitigation: lock-in rate at confirmation time, not payout time.

## What this enables (Phase 3+)

Once auth + ledger exist, the next set of features become cheap:
- Saved products / price-drop alerts (existing user_id column on a new table)
- Personalised /deals (rank by user's past click categories)
- Watchlists (user_id + product_id)
- Newsletter segmentation (high-value users get different campaign)
- Referral programme (referrer_user_id on cashback_clicks)

Phase 2's real value isn't just the cashback feature — it's the user-account foundation everything else rides on.

## Next step

Ship Phase 1's analytics for at least 30 days. If the `cashback_badge_click` event count is meaningful (say, > 5% of unique visitors clicking at least one badge), commit to Sprint 1. If it's negligible, the feature isn't pulling weight on engagement and we should investigate why before building Phase 2.
