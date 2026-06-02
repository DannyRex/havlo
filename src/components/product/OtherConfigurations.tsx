/* "Other configurations" disclosure for the PDP.

   Why this exists: a product like "MacBook Air 15 M3 256GB Starlight"
   can legitimately have only ONE store in our catalog, while the same
   line in OTHER configs (512GB, a different colour, M4, the 13-inch)
   lives under separate product rows. Those are NOT the same product, so
   pooling their prices into the comparison above would contradict the
   anchor's numbers — showing a 512GB price against a 256GB search is the
   exact "numbers contradict" trap we avoid. Instead we surface them here
   as a SEPARATE, clearly-labelled set of jumping-off links.

   Two deliberate choices, both straight from the May 2026 sibling-rail
   removal note (which asked for an explicit "compare configurations"
   click rather than an auto-rendered rail that steers a base-tier
   shopper to a sub-tier they didn't ask for):
     1. Native <details> — collapsed by default, so nothing is pushed at
        the user; they opt in with a click. Works without JS, and the
        links stay in crawlable HTML (a de-orphaning bonus).
     2. Each row links to that config's OWN PDP and shows that config's
        OWN cheapest price + store count. No number here feeds the
        anchor's comparison, so nothing can contradict it.

   Server component — pure helpers only, no client state. (#15) */

import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";
import { cleanTitle, formatPriceForUser, proxiedImageUrl } from "@/lib/utils";
import { effectiveLandedPrice } from "@/lib/landed-price";
import { pdpUrlForOffer } from "@/lib/pdp-url";
import type { Country } from "@/lib/country";
import type { DupeResult } from "@/lib/search";

interface Props {
  /** Same brand + same model line as the anchor, different config
      (size / storage / colour / generation). Selected by
      selectLineConfigs and already accessory/counterfeit/country-
      filtered upstream by the dupes engine. */
  configs: DupeResult[];
  country: Country;
}

/* Cap the list so a long line (every MacBook Air config, every iPhone
   trim) stays a tidy disclosure rather than a wall. The brand hub link
   in "Keep browsing" already covers the long tail. */
const MAX_ROWS = 8;

export default function OtherConfigurations({ configs, country }: Props) {
  if (configs.length === 0) return null;

  const rows = configs
    .map((d) => {
      /* Cheapest offer by the SAME country-aware landed definition every
         other surface uses, so this config's "from" price matches what
         the user sees once they open its page. */
      const best = [...d.offers].sort(
        (a, b) => effectiveLandedPrice(a, country) - effectiveLandedPrice(b, country),
      )[0];
      if (!best) return null;
      const storeCount = new Set(d.offers.map((o) => o.storeId)).size;
      return {
        key:       d.key,
        title:     cleanTitle(d.title),
        image:     d.imageUrl ?? best.imageUrl ?? null,
        fromPrice: formatPriceForUser(effectiveLandedPrice(best, country), country),
        storeCount,
        href:      pdpUrlForOffer(country.code, { ...best, title: d.title }),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, MAX_ROWS);

  if (rows.length === 0) return null;

  return (
    <section className="mt-12 sm:mt-16">
      <details className="group rounded-2xl border border-border bg-surface-2/50">
        <summary className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
          <Layers size={16} className="shrink-0 text-ink-3" aria-hidden="true" />
          <span className="text-sm font-semibold text-ink">
            Other configurations
            <span className="ml-1.5 font-normal text-ink-3">({rows.length})</span>
          </span>
          <ChevronRight
            size={16}
            className="ml-auto shrink-0 text-ink-3 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>

        <div className="px-4 sm:px-5 pb-4">
          <p className="mb-3 text-xs leading-relaxed text-ink-3">
            Other versions in this line (different size, storage, colour, or generation).
            Each is a separate product with its own page and price, so these are not part of the comparison above.
          </p>
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={r.href}
                  className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5 transition-colors hover:border-border-strong"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                    {r.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={proxiedImageUrl(r.image)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{r.title}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">
                      from {r.fromPrice} · {r.storeCount} {r.storeCount === 1 ? "store" : "stores"}
                    </span>
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-ink-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}
