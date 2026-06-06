import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { DISPLAY } from "../fonts";
import { SceneShell, useEnter, Eyebrow, clamp, type Ctx } from "./_common";
import { money } from "../data";

const BADGE_INK = "#06281A";

/* Scene 3 — local + global. Real Stores H2; two cards, global wins. */
export const SceneCompare: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const { theme: t, market: m } = ctx;
  const frame = useCurrentFrame();
  const enter = useEnter();
  const eb = enter(2);
  const lin = enter(12);
  const rin = enter(22);
  const hi = interpolate(frame, [66, 84], [0, 1], clamp);
  const saveAmt = m.localPrice - m.globalPrice;
  const saveVal = Math.round(interpolate(frame, [88, 122], [0, saveAmt], clamp));
  const saveIn = enter(88, 90);

  const Card: React.FC<{ label: string; price: number; best?: boolean; appear: number; shift: number }> = ({ label, price, best, appear, shift }) => (
    <div style={{ opacity: interpolate(appear, [0, 1], [0, 1]) * (best ? 1 : interpolate(hi, [0, 1], [1, 0.5])), transform: `translateX(${interpolate(appear, [0, 1], [shift, 0])}px) scale(${best ? interpolate(hi, [0, 1], [1, 1.05]) : 1})`, width: 440, background: t.surface, border: `1.5px solid ${best ? t.green : t.border}`, borderRadius: 22, padding: "32px 34px", display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ color: t.inkSub, fontSize: 26, fontWeight: 700 }}>{label}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: 56, fontWeight: 800, color: best && hi > 0.4 ? t.green : t.ink, fontVariantNumeric: "tabular-nums" }}>{money(m, price)}</span>
      {best && hi > 0.4 && <span style={{ opacity: interpolate(hi, [0.4, 1], [0, 1], clamp), alignSelf: "flex-start", background: t.green, color: BADGE_INK, fontSize: 16, fontWeight: 800, padding: "4px 12px", borderRadius: 99 }}>BEST PRICE</span>}
    </div>
  );

  return (
    <SceneShell theme={t}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <Eyebrow theme={t} opacity={eb}>Local + global stores</Eyebrow>
        <div style={{ opacity: eb, fontFamily: DISPLAY, fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink, textAlign: "center", maxWidth: 1150 }}>
          We check the stores you already know.
        </div>
        <div style={{ opacity: eb, color: t.inkSub, fontSize: 28, fontWeight: 500, marginTop: -8 }}>
          Your favourite store isn&apos;t always the cheapest.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 4 }}>
          <Card label={m.localStore} price={m.localPrice} appear={lin} shift={-60} />
          <span style={{ opacity: lin, color: t.inkFaint, fontSize: 28, fontWeight: 700 }}>vs</span>
          <Card label={m.globalStore} price={m.globalPrice} best appear={rin} shift={60} />
        </div>

        <div style={{ opacity: interpolate(saveIn, [0, 1], [0, 1]), transform: `translateY(${interpolate(saveIn, [0, 1], [16, 0])}px)`, display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
          <span style={{ color: t.inkSub, fontSize: 30, fontWeight: 600 }}>You save</span>
          <span style={{ fontFamily: DISPLAY, color: t.green, fontSize: 54, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{money(m, saveVal)}</span>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
