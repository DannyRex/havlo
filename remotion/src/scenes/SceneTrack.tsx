import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { DISPLAY } from "../fonts";
import { SceneShell, useEnter, Eyebrow, clamp, type Ctx } from "./_common";
import { money } from "../data";

/* Scene 4 — price tracking + alert. Line draws down, lowest marker,
   then a price-drop alert (real product + market prices). */
export const SceneTrack: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const { theme: t, market: m } = ctx;
  const frame = useCurrentFrame();
  const enter = useEnter();
  const eb = enter(2);
  const card = enter(10);
  const draw = interpolate(frame, [18, 84], [0, 1], clamp);
  const dot = interpolate(frame, [80, 92], [0, 1], clamp);
  const alertIn = enter(104, 90);

  return (
    <SceneShell theme={t}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <Eyebrow theme={t} opacity={eb}>Price tracking</Eyebrow>
        <div style={{ opacity: eb, fontFamily: DISPLAY, fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink }}>Watch the price. Buy at the bottom.</div>

        <div style={{ opacity: card, transform: `translateY(${interpolate(card, [0, 1], [22, 0])}px)`, width: 780, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 22, padding: "30px 28px 24px" }}>
          <svg width="100%" viewBox="0 0 720 240" style={{ display: "block", overflow: "visible" }}>
            <line x1="14" y1="214" x2="706" y2="214" stroke={t.border} strokeWidth="2" />
            <path d="M14,70 L130,96 L246,78 L362,138 L478,118 L594,184 L706,168" fill="none" stroke={t.green} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
            <circle cx={594} cy={184} r={11 * dot} fill={t.green} />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, color: t.inkFaint, fontSize: 20, fontWeight: 500 }}>
            <span>30 days ago</span>
            <span style={{ opacity: dot, color: t.green, fontWeight: 800 }}>Lowest in 30 days</span>
            <span>Today</span>
          </div>
        </div>

        <div style={{ opacity: interpolate(alertIn, [0, 1], [0, 1]), transform: `translateY(${interpolate(alertIn, [0, 1], [26, 0])}px)`, display: "flex", alignItems: "center", gap: 18, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 18, padding: "17px 26px" }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: t.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#06281A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: t.ink, fontSize: 25, fontWeight: 700 }}>Price dropped</span>
            <span style={{ color: t.inkSub, fontSize: 21, fontWeight: 500 }}>
              {m.product} · <span style={{ color: t.inkFaint, textDecoration: "line-through" }}>{money(m, m.trackFrom)}</span>{" "}
              <span style={{ color: t.green, fontWeight: 800 }}>{money(m, m.trackTo)}</span>
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
