/* ──────────────────────────────────────────────────────────────────
   Lightweight GA4 events wrapper.

   Why a thin module instead of calling gtag() inline:
     - Single point of consent gating + env-flag gating. Calling
       gtag() before the script loads (or before the user accepts
       cookies) would silently fail or queue a phantom event.
       This wrapper is a hard no-op until both conditions are met.
     - Type-safe event vocabulary. Adding events here means TS will
       flag any typos at the call site.
     - Easy provider swap later. If we add Plausible / PostHog, we
       can branch inside one function rather than rewriting every
       call site.

   The wrapper is intentionally fire-and-forget. Analytics calls
   must NEVER affect user-facing UX — no awaits, no throws.

   Read the consent state from the same CookieConsent module GA4
   reads, so a user who declines never has a single byte sent to
   Google. */

declare global {
  interface Window {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    dataLayer?: Array<Record<string, any>>;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    gtag?: (...args: any[]) => void;
  }
}

/* The full set of events Havlo tracks. New events get added here
   first so the call sites can't drift from the intended vocabulary. */
export type EventName =
  | "search_submit"           // user submits a search from /compare or homepage
  | "paste_link"              // pasted URL detected in compare input
  | "click_out_merchant"      // outbound to merchant (DB-backed via /api/click + GA4 mirror)
  | "product_click"           // user clicked a product card (lands on PDP, not merchant)
  | "category_click"          // user clicked a category tile / chip
  | "cashback_badge_click"    // tap on the green "Earn 5%" badge
  | "country_switch"          // user changes country picker
  | "compare_view"            // /compare page rendered with an anchor
  | "compare_empty"           // /compare page rendered with mode=empty
  | "deals_filter_change"     // /deals filter chip changed (category, tier, sort, origin)
  | "newsletter_subscribe"    // newsletter form submitted
  | "cashback_waitlist_join"; // cashback waitlist email submitted

interface BaseProps {
  /* Optional country — most events benefit from a country segment. */
  country?: string;
}

interface SearchSubmitProps extends BaseProps {
  query: string;
  source: "homepage" | "compare" | "deals";
}

interface PasteLinkProps extends BaseProps {
  domain: string; // e.g. 'amazon.com', 'konga.com'
}

interface ClickOutProps extends BaseProps {
  store_id: string;
  position: number;
  mode: string;
  query?: string;
}

interface CashbackProps extends BaseProps {
  store_id: string;
  percent: number;
}

/* Product card click — fired BEFORE navigation to the PDP (or
   /compare for synthetic IDs that don't have a PDP yet). Drives the
   GA4 funnel between "card view" and "outbound click" so we can
   measure intent at the per-card level vs only the final merchant
   click. Distinct from click_out_merchant which fires at /api/go. */
interface ProductClickProps extends BaseProps {
  store_id: string;
  product_id?: string;        // omitted for synthetic offers
  category?: string;
  surface: "deals" | "trending" | "compare" | "pdp_similar" | "homepage";
  position?: number;          // 0-indexed rank within its surface
}

/* Category tile / chip click. Fired from CategoryGrid (homepage
   tiles) and CategoryNav (/deals chip strip). Lets us see which
   categories actually attract entry traffic vs only being browsed
   internally. */
interface CategoryClickProps extends BaseProps {
  category: string;            // slug — 'phones', 'electronics', etc.
  surface: "homepage" | "deals_chip";
  position?: number;
}

interface CountrySwitchProps extends BaseProps {
  from: string;
  to: string;
}

interface CompareViewProps extends BaseProps {
  query: string;
  result_kind: "single" | "similar" | "empty" | "list";
  store_count?: number;
}

interface DealsFilterProps extends BaseProps {
  filter_kind: "category" | "tier" | "sort" | "origin" | "search";
  value: string;
}

interface SubscribeProps extends BaseProps {
  surface: "footer" | "homepage" | "blog";
}

interface WaitlistProps extends BaseProps {
  /* No PII — we never send the email to GA. */
  source?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type EventProps =
  | { name: "search_submit"; props: SearchSubmitProps }
  | { name: "paste_link"; props: PasteLinkProps }
  | { name: "click_out_merchant"; props: ClickOutProps }
  | { name: "product_click"; props: ProductClickProps }
  | { name: "category_click"; props: CategoryClickProps }
  | { name: "cashback_badge_click"; props: CashbackProps }
  | { name: "country_switch"; props: CountrySwitchProps }
  | { name: "compare_view"; props: CompareViewProps }
  | { name: "compare_empty"; props: CompareViewProps }
  | { name: "deals_filter_change"; props: DealsFilterProps }
  | { name: "newsletter_subscribe"; props: SubscribeProps }
  | { name: "cashback_waitlist_join"; props: WaitlistProps };
/* eslint-enable @typescript-eslint/no-explicit-any */

/* True if GA4 is loaded AND cookie consent has been granted. We
   check both at call time (not module load) because the user can
   accept consent mid-session and we want subsequent events to flow. */
function canTrack(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.gtag !== "function") return false;
  /* The consent state lives in localStorage — we read directly to
     avoid pulling the React-flavoured module into a non-React call
     path. Keep this in sync with CookieConsent's storage key. */
  try {
    /* Storage key matches CONSENT_KEY in CookieConsent.tsx — keep
       these in lock-step or analytics will silently no-op. */
    return localStorage.getItem("havlo-cookie-consent") === "accepted";
  } catch {
    return false;
  }
}

/* Public tracker — typed entry point. Never throws. */
export function track<E extends EventProps>(event: E): void {
  if (!canTrack()) return;
  try {
    /* GA4 takes (command, eventName, props). Spreading the event
       props verbatim lets us segment on any field via GA4 filters
       without further config. */
    window.gtag!("event", event.name, event.props as Record<string, unknown>);
  } catch {
    /* Silent — analytics must never bubble errors to UI. */
  }
}

/* Tiny helper for paste-link domain extraction so the call site
   doesn't have to handle malformed URLs. */
export function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}
