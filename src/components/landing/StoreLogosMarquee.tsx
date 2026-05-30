"use client";

/* ──────────────────────────────────────────────────────────────────
   Lazy-mounted store-logo marquee (LCP rework v6, May 2026).

   The marquee is two scroll tracks of ~20-22 favicon chips each, so it
   ships ~40-48 <img> elements plus ~200 wrapper nodes. That used to
   render in the homepage's SSR document — and even though it sits far
   below the fold (after the hero, trending grid, cashback teaser and
   category grid), the browser still had to build + lay out all of it
   before it could paint the trending grid's first product image, which
   is the mobile LCP element.

   Lighthouse's mobile pass (slow-4G + 4× CPU) charged that extra layout
   to LCP "render delay" (~3.6s) with TBT still near zero — i.e. it
   wasn't slow JS, it was the sheer size of the initial DOM. Pulling the
   chips out of the first render is the lever: the section's heading
   stays server-rendered for SEO, but the chips mount only when the row
   scrolls near the viewport. A Lighthouse run never scrolls, so it never
   pays for them, and the LCP paints against a much lighter document.

   A fixed-height shell reserves the row's vertical space so mounting the
   chips later causes no layout shift. IntersectionObserver fires a little
   before the row enters view (rootMargin) so real users never see an
   empty band, and we fail open (render immediately) where the API is
   missing. */

import { useEffect, useRef, useState } from "react";
import { StoreLogoChip, type StoreEntry } from "./StoreLogoChip";

function Track({ stores, ariaHidden = false }: { stores: StoreEntry[]; ariaHidden?: boolean }) {
  return (
    <div className="flex items-center gap-8 sm:gap-14 px-4 sm:px-7 shrink-0" aria-hidden={ariaHidden}>
      {stores.map((store) => (
        <StoreLogoChip
          key={store.name + (ariaHidden ? "-clone" : "")}
          store={store}
          ariaHidden={ariaHidden}
        />
      ))}
    </div>
  );
}

export default function StoreLogosMarquee({ stores }: { stores: StoreEntry[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    /* No IntersectionObserver (very old browsers / jsdom) → render now
       rather than leave a permanently empty band. */
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      /* Start mounting ~300px before the row scrolls into view so the
         favicons are painted by the time the user reaches them. */
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    /* min-h reserves the single chip-row's height (chip is h-7 sm:h-8,
       +1px border each side) so the deferred mount doesn't shift the
       sections below it. */
    <div ref={ref} className="relative overflow-hidden min-h-[32px] sm:min-h-[36px]">
      {visible && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 z-10"
            style={{ background: "linear-gradient(to right, rgb(var(--bg-rgb)) 0%, transparent 100%)" }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 z-10"
            style={{ background: "linear-gradient(to left, rgb(var(--bg-rgb)) 0%, transparent 100%)" }}
          />

          <div className="marquee-track flex">
            <Track stores={stores} />
            <Track stores={stores} ariaHidden />
          </div>
        </>
      )}
    </div>
  );
}
