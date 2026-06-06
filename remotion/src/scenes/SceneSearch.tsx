import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { DISPLAY } from "../fonts";
import { SceneShell, useEnter, Eyebrow, clamp, type Ctx } from "./_common";

/* Scene 2 — search. Real Hero subhead; the product types into the bar. */
export const SceneSearch: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const { theme: t, market: m } = ctx;
  const frame = useCurrentFrame();
  const enter = useEnter();
  const eb = enter(2);
  const bar = enter(10);
  const q = m.product;
  const n = Math.round(interpolate(frame, [18, 74], [0, q.length], clamp));
  const typed = q.slice(0, n);
  const caret = frame % 24 < 12;
  const resIn = enter(88, 90);

  return (
    <SceneShell theme={t}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34, padding: "0 120px" }}>
        <Eyebrow theme={t} opacity={eb}>Search anything</Eyebrow>
        <div style={{ opacity: eb, fontFamily: DISPLAY, fontSize: 56, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink, textAlign: "center" }}>
          Paste a link or search any product.
        </div>

        <div style={{ opacity: bar, transform: `translateY(${interpolate(bar, [0, 1], [22, 0])}px)`, display: "flex", alignItems: "center", gap: 20, width: 1000, background: t.surface, border: `2px solid ${t.green}`, boxShadow: `0 0 44px ${t.greenSoft}`, borderRadius: 22, padding: "26px 34px" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={t.inkSub} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
          <span style={{ fontSize: 40, fontWeight: 600, color: t.ink }}>{typed}<span style={{ opacity: caret ? 1 : 0, color: t.green }}>|</span></span>
        </div>

        <div style={{ opacity: interpolate(resIn, [0, 1], [0, 1]), transform: `translateY(${interpolate(resIn, [0, 1], [18, 0])}px)`, display: "flex", alignItems: "center", gap: 16, color: t.inkSub, fontSize: 30, fontWeight: 600 }}>
          <span style={{ width: 13, height: 13, borderRadius: 99, background: t.green }} />
          Compared across <span style={{ color: t.ink, fontWeight: 800 }}>1,500+ stores</span> in seconds
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
