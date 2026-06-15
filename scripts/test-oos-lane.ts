#!/usr/bin/env tsx
/* Deterministic unit test for the #5 OOS context lane in computeAnchorStats.
   Proves the honesty-critical invariants: an out-of-stock offer NEVER enters
   the live spectrum / count / cheapest, only the separate context lane; and
   the same-store + freshness guards work. Run:
     npx tsx --tsconfig tsconfig.scripts.json scripts/test-oos-lane.ts */

import { computeAnchorStats } from "../src/lib/pdp-stats";
import { getCountry } from "../src/lib/country";
import type { StoreOffer } from "../src/lib/search";

const country = getCountry("ng");

function offer(p: Partial<StoreOffer> & { storeId: string; price: number }): StoreOffer {
  return {
    offerId: `${p.storeId}-${p.price}`,
    storeId: p.storeId,
    storeName: p.storeId.toUpperCase(),
    storeLogoUrl: "",
    storeColor: "#000",
    price: p.price,
    currency: "NGN",
    url: `https://${p.storeId}.example/x`,
    productTitle: "Test Widget 256GB",
    originalPrice: p.price,
    discountPercent: 0,
    rating: 0,
    deliveryDays: 3,
    isInternational: false,
    landedCostExtra: 0,
    landedPrice: p.price,
    storeCountry: "NG",
    inStock: p.inStock,
    lastSeenAt: p.lastSeenAt,
  };
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

const recent = new Date(Date.now() - 3 * 864e5).toISOString();
const stale  = new Date(Date.now() - 120 * 864e5).toISOString();

console.log("Case 1: in-stock A@1000 + OOS B@800 (recent, different store, CHEAPER)");
{
  const s = computeAnchorStats(
    [offer({ storeId: "a", price: 1000, inStock: true }),
     offer({ storeId: "b", price: 800, inStock: false, lastSeenAt: recent })],
    1000, country, null, "Test Widget 256GB",
  );
  check("OOS not in perStoreOffers", !s.perStoreOffers.some((o) => o.storeId === "b"));
  check("OOS not in comparableOffers", !s.comparableOffers.some((o) => o.storeId === "b"));
  check("totalStores excludes OOS (=1)", s.totalStores === 1, `got ${s.totalStores}`);
  check("cheapest is the live A@1000, NOT the OOS B@800",
        s.perStoreOffers[0]?.effectiveNgn === 1000, `got ${s.perStoreOffers[0]?.effectiveNgn}`);
  check("outOfStock lane contains B", s.outOfStock.some((o) => o.storeId === "b" && o.isOutOfStock));
  check("OOS row carries lastSeenAt", !!s.outOfStock[0]?.lastSeenAt);
}

console.log("\nCase 2: same-store suppression — A in-stock@1000 + A OOS@800");
{
  const s = computeAnchorStats(
    [offer({ storeId: "a", price: 1000, inStock: true }),
     offer({ storeId: "a", price: 800, inStock: false, lastSeenAt: recent })],
    1000, country, null, "Test Widget 256GB",
  );
  check("OOS at a buyable store is suppressed (lane empty)", s.outOfStock.length === 0, `got ${s.outOfStock.length}`);
}

console.log("\nCase 3: freshness gate — OOS B@800 but 120 days old");
{
  const s = computeAnchorStats(
    [offer({ storeId: "a", price: 1000, inStock: true }),
     offer({ storeId: "b", price: 800, inStock: false, lastSeenAt: stale })],
    1000, country, null, "Test Widget 256GB",
  );
  check("stale OOS dropped (lane empty)", s.outOfStock.length === 0, `got ${s.outOfStock.length}`);
}

console.log("\nCase 4: no inStock field (legacy offers) treated as in-stock");
{
  const s = computeAnchorStats(
    [offer({ storeId: "a", price: 1000 }), offer({ storeId: "b", price: 1200 })],
    1000, country, null, "Test Widget 256GB",
  );
  check("both legacy offers counted live", s.totalStores === 2, `got ${s.totalStores}`);
  check("no OOS lane", s.outOfStock.length === 0);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
