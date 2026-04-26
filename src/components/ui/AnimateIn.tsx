"use client";

/* ──────────────────────────────────────────────────────────────────
   Scroll-triggered fade-up animation wrapper.

   Uses IntersectionObserver to start the animation only when the
   element enters the viewport — items below the fold don't render
   their animation until the user scrolls to them, so the page feels
   alive as you scroll rather than blasting all 50 cards at once.

   Respects `prefers-reduced-motion`: skips animation entirely.

   Usage:
     <AnimateIn delay={120}>
       <MasonryCard deal={d} aspect="aspect-[3/4]" />
     </AnimateIn>
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Delay before the fade starts, in ms. Use small per-index values to
      stagger a wave effect across rows (e.g. delay={i * 50}). */
  delay?: number;
  /** Fraction of element visible before the animation triggers. 0–1. */
  threshold?: number;
  /** Optional class on the wrapper. */
  className?: string;
}

export default function AnimateIn({
  children,
  delay = 0,
  threshold = 0.1,
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    /* Reduced-motion users: skip animation entirely, render in place. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: visible ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
