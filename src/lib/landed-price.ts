/* Country-aware landed-price + delivery helpers.

   Background: pgFtsFindDupes / pgFtsFindSimilar bake a 30% landed-cost
   estimate into every offer where stores.is_international = true. The
   flag is currency-based (set at ingest as `currency === "USD"`), so
   it fires for every UK / US / DE / AE / IN / ZA retailer Havlo
   indexes via SerpAPI — including UK retailers like Currys.

   That made the compare page show "Currys £1,173 · Cross-border ·
   14 days delivery" to a UK shopper looking at a UK-shipped Currys
   offer where the actual merchant price is £902. User report May
   2026: "Motorola Razr was a different price on PDP vs compare."

   Fix: at the UI layer, recompute "is this offer cross-border for
   THIS visitor" using inferStoreCountry (same roster the badge
   logic in DupeCard / PriceResults / MasonryCard already uses).
   Local-to-user offers display the BASE price + local delivery
   estimate; true cross-border offers keep the landed price + 14d
   delivery shown. Same fix shape as the May 2026 INTL-badge work,
   just extended into the price math.

   Pure functions, no React/server-only deps — safe to import from
   client components, server components, or scripts. */

import type { Country } from "./country";
import { isGlobalIntlStore, resolveStoreCountry } from "./country";

/* ── Cross-border landed-cost rate ─────────────────────────────────
   The "landed" total Havlo shows for an international offer is the
   merchant price plus this flat allowance for shipping + import duty.

   It is deliberately ONE blunt number, not per-item math: at display
   time we have no carrier quote, parcel weight, or per-country duty
   schedule, so a single ~30% allowance is the honest resolution of
   what we actually know. Because it is an approximation, EVERY surface
   that renders a landed total must frame it as a rough estimate (the
   "est." cue + the "rough estimate" disclaimers) and never as precise
   per-item cost. Centralised here so the rate has exactly one home and
   the compare row, PDP hero, deal cards and price spectrum can never
   drift onto different multipliers. (#14) */
export const LANDED_RATE = 0.30;

/* Merchant price plus the flat landed allowance. Bit-identical to the
   historical `base * 1.30` literal this replaces: 1 + 0.30 === 1.3
   exactly in IEEE-754 (both 0x3FF4CCCCCCCCCCCD), so centralising the
   rate changes no displayed or ranked number — it is a pure refactor.
   Returns a raw number; callers Math.round + format at the display
   layer. */
export function landedTotal(base: number): number {
  return base * (1 + LANDED_RATE);
}

/* Minimal offer shape we need to make the call. Subset of StoreOffer
   so the helper accepts both the dupes-engine StoreOffer AND any
   future shape that carries the same identity + price fields. */
export interface OfferLike {
  storeId:         string;
  storeName:       string;
  currency:        "NGN" | "USD";
  isInternational: boolean;
  /** DB-authoritative anchor market (stores.country, uppercase ISO).
      Preferred over the JS roster when present — see
      resolveStoreCountry. Optional so older call sites that don't
      thread it through keep the inferStoreCountry-only behaviour. */
  storeCountry?:   string | null;
  /** Base merchant price in NGN (the dupes engine normalises every
      offer to NGN regardless of source currency). */
  price:           number;
  /** Estimated landed shipping + customs in NGN. Set to ~30% of price
      for stores where isInternational=true at ingest time. */
  landedCostExtra: number;
  /** price + landedCostExtra, computed at ingest. */
  landedPrice:     number;
}

/* True if the offer is cross-border FOR THIS VISITOR.
     1. Store is anchored to a country (UK / US / DE / AE / IN / ZA / NG)
        → cross-border iff that country isn't the visitor's.
     2. Store is a known global cross-border (AliExpress / Shein /
        Temu / DHgate / …) → always cross-border.
     3. Fall back to the currency-mismatch heuristic for unknown
        long-tail stores. */
export function isCrossBorderForUser(offer: OfferLike, country: Country): boolean {
  const storeCountry = resolveStoreCountry(offer.storeId, offer.storeName, offer.storeCountry);
  if (storeCountry !== null) {
    return storeCountry.toLowerCase() !== country.code.toLowerCase();
  }
  if (isGlobalIntlStore(offer.storeId, offer.storeName)) return true;
  return offer.currency !== country.currency && offer.isInternational;
}

/* Effective price the visitor will compare against. Local stores show
   the base merchant price (no landed estimate added); cross-border
   stores show price + landedCostExtra. Cheaper of the two ranking
   pivots becomes the "best price" for sort purposes. */
export function effectiveLandedPrice(offer: OfferLike, country: Country): number {
  return isCrossBorderForUser(offer, country)
    ? offer.landedPrice
    : offer.price;
}

/* Effective delivery-day estimate. Cross-border stays at the bake-time
   14-day estimate; local stores fall back to a sensible domestic
   default (3 days). Future: per-country domestic SLA could refine
   this, but a uniform 3-day local default is fine for compare-card
   copy until we have real merchant SLA data. */
export function effectiveDeliveryDays(
  offer: OfferLike & { deliveryDays?: number },
  country: Country,
): number {
  if (isCrossBorderForUser(offer, country)) return offer.deliveryDays ?? 14;
  return 3;
}

/* True when ANY offer in the array is genuinely cross-border for this
   visitor. Used to gate the "Cross-border prices include a ~30%
   landed estimate" disclaimer — should only render when at least one
   row in the displayed table is intl for the user, otherwise it's
   irrelevant copy. */
export function anyCrossBorderForUser<T extends OfferLike>(offers: T[], country: Country): boolean {
  return offers.some((o) => isCrossBorderForUser(o, country) && o.landedCostExtra > 0);
}
