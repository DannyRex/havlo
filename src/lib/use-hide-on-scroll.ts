import { useEffect, useRef, useState, type RefObject } from "react";

/* Headroom helper for a sticky bar. Returns `true` while the user scrolls
   DOWN (so the bar can slide up out of view) and `false` as soon as they
   scroll UP even slightly (so it reappears). rAF-throttled with an 8px
   delta deadzone so micro-scrolls don't strobe it; setHidden is a no-op on
   an unchanged value, so it only re-renders on a direction change. Pair
   with a `-translate-y-full` transform gated behind `sm:` so the hide is
   mobile-only and tucks behind the (opaque, higher-z) navbar while desktop
   stays pinned. Shared by /deals + Amazon filter bars.

   Pass `barRef` (the sticky bar element): the bar is only hidden once it's
   actually PINNED under the navbar (its rect.top has reached `stickyTop`).
   Hiding it while it's still in normal flow translated it up but left its
   flow-space behind, opening a tall gap between the filter row and the
   grid (user report, June 2026: "filters scroll up too soon, big space
   above the products"). Without a ref it falls back to the bare
   scroll-distance threshold. */
export function useHideOnScrollDown(
  barRef?: RefObject<HTMLElement | null>,
  stickyTop = 64, // matches `top-16`
  threshold = 140,
): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (Math.abs(delta) > 8) {
          /* "Stuck" = the bar has reached its sticky position under the
             navbar. Only then is translating it up safe (no flow-space
             gap). Once hidden its rect.top is negative, so it stays
             stuck-true and keeps hiding on continued scroll-down. */
          const stuck = barRef?.current
            ? barRef.current.getBoundingClientRect().top <= stickyTop + 1
            : y > threshold;
          if (delta > 0 && y > threshold && stuck) setHidden(true);
          else if (delta < 0) setHidden(false);
          lastY.current = y;
        }
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [barRef, stickyTop, threshold]);
  return hidden;
}
