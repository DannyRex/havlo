import { useEffect, useRef, useState } from "react";

/* Headroom helper for a sticky bar. Returns `true` while the user scrolls
   DOWN past `threshold` px (so the bar can slide up out of view) and `false`
   as soon as they scroll UP even slightly (so it reappears). rAF-throttled
   with an 8px delta deadzone so micro-scrolls don't strobe it; setHidden is
   a no-op on an unchanged value, so it only re-renders on a direction
   change. Pair with a `-translate-y-full` transform gated behind `sm:` so
   the hide is mobile-only and tucks behind the (opaque, higher-z) navbar
   while desktop stays pinned. Shared by /deals + Amazon filter bars. */
export function useHideOnScrollDown(threshold = 140): boolean {
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
          if (delta > 0 && y > threshold) setHidden(true);
          else if (delta < 0) setHidden(false);
          lastY.current = y;
        }
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return hidden;
}
