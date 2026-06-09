"use client";

/* Floating "back to top" button for long scroll surfaces like /deals
   (#21). Appears once the visitor scrolls past the fold, smooth-scrolls
   to the top on click, and respects prefers-reduced-motion. Fixed at the
   bottom-right, above page content but below any modal layer. It's a
   real <button> so it's keyboard-focusable and screen-reader labelled;
   when hidden it's pointer-events-none so it never blocks taps. */

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function ScrollToTopButton({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll(); // sync initial state (e.g. restored scroll position)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const toTop = () => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Scroll back to top"
      className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2/90 text-ink shadow-lg backdrop-blur transition-all duration-200 hover:border-border-strong hover:bg-surface motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
