import { useEffect, useRef, useState } from "react";

/* Hide-on-scroll for a mobile sticky bar. Returns `true` while the user
   is scrolling DOWN past `threshold` px (so a sticky bar can slide out of
   view and hand the screen back to the content beneath it) and `false`
   when they scroll UP. rAF-throttled with an 8px delta deadzone so
   micro-scrolls / momentum don't strobe it, plus a threshold so it never
   hides while the user is still near the top. setHidden(x) is a no-op in
   React when the value is unchanged, so this only re-renders on a
   direction change, not on every scroll frame.

   Pair it with a transform gated behind `sm:` (e.g. `sm:translate-y-0`)
   so the hide applies on mobile only and desktop stays pinned. Shared by
   the /deals feed filter bar and the Amazon deals filter bar. */
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
