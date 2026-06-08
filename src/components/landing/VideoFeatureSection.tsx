"use client";

/* Homepage feature section — a headline + body on one side and an
   autoplay/loop/muted product-demo video on the other, alternating
   sides and backgrounds down the page (the spoken.io pattern, applied
   to Havlo's own CursorFlow / price-drop clips).

   Perf is the whole game with autoplay video on a marketing page:
     • preload="none" + IntersectionObserver — the file is only fetched
       when the section scrolls near the viewport, so above-the-fold
       LCP (the hero search box) is untouched and a visitor who never
       scrolls pays zero bytes.
     • theme-aware src — the clip's UI matches the active theme, picked
       client-side from next-themes (no SSR src, so no hydration churn).
     • prefers-reduced-motion — we don't autoplay for users who opt out;
       the first frame stays as a still.
   The container reserves a 16:9 box up front so the late-loading video
   can't shift layout (CLS). */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowRight } from "lucide-react";

interface Props {
  eyebrow?: string;
  /** Lead of the headline (rendered in the default ink colour). */
  title: string;
  /** Optional trailing fragment rendered in the brand colour. */
  titleAccent?: string;
  body: string;
  srcLight: string;
  srcDark: string;
  /** Optional text-link CTA under the body. */
  cta?: { label: string; href: string };
  /** Flip the column order on md+ so sections alternate L/R. */
  reverse?: boolean;
  /** Tinted band (bg-surface + border) vs plain bg. Alternate per section. */
  surface?: boolean;
}

export default function VideoFeatureSection({
  eyebrow, title, titleAccent, body, srcLight, srcDark, cta, reverse, surface,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setMounted(true), []);

  /* Fetch + play only when the video box is within 200px of the
     viewport. Disconnect after the first hit — once loaded it stays. */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setInView(true); io.disconnect(); } },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const src = mounted && resolvedTheme === "dark" ? srcDark : srcLight;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !inView || !src) return;
    if (v.getAttribute("src") !== src) { v.setAttribute("src", src); v.load(); }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) v.play().catch(() => { /* autoplay can be blocked; first frame stays */ });
  }, [inView, src]);

  return (
    <section className={surface ? "py-14 sm:py-24 bg-surface border-y border-border" : "py-14 sm:py-24 bg-bg"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Asymmetric columns so the video frame is the dominant element
            (~57% width) on either side. The wider fraction always lands
            where the video sits, so it stays big as the sections
            alternate L/R. */}
        <div className={`grid items-center gap-8 sm:gap-12 lg:gap-16 ${reverse ? "md:grid-cols-[1.3fr_1fr]" : "md:grid-cols-[1fr_1.3fr]"}`}>
          {/* Copy */}
          <div className={reverse ? "md:order-2" : ""}>
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 mb-3">
                {eyebrow}
              </p>
            )}
            {/* Title stays a single ink colour (no accent tint) to match
                the other homepage section headings. */}
            <h2 className="text-[26px] sm:text-4xl font-bold text-ink tracking-[-0.025em] leading-[1.1] mb-4">
              {title}
              {titleAccent ? <> {titleAccent}</> : null}
            </h2>
            <p className="text-[15px] sm:text-base text-ink-2 leading-relaxed max-w-md">
              {body}
            </p>
            {cta && (
              <Link
                href={cta.href}
                className="mt-6 flex w-fit mx-auto md:mx-0 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink transition-colors group/cta"
              >
                {cta.label}
                <ArrowRight size={16} className="transition-transform group-hover/cta:translate-x-0.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          {/* Demo video. aspect-video reserves the box so the lazy load
              can't shift layout; object-contain shows the whole UI on a
              surface-2 backing rather than cropping it. */}
          <div
            ref={boxRef}
            className={`relative aspect-video rounded-2xl overflow-hidden border border-border bg-surface-2 shadow-sm ${reverse ? "md:order-1" : ""}`}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
