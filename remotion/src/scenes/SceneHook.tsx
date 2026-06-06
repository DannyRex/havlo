import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { DISPLAY } from "../fonts";
import { SceneShell, useEnter, clamp, type Ctx } from "./_common";
import { money } from "../data";

const BADGE_INK = "#06281A";

/* Scene 1 — the hook. Hero H1 + one product, real store prices, cheapest
   snaps to green, "you save" counts up. */
export const SceneHook: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const { theme: t, market: m } = ctx;
  const frame = useCurrentFrame();
  const enter = useEnter();
  const head = enter(0);
  const chip = enter(24);
  const low = m.hook.length - 1;
  const hi = interpolate(frame, [112, 130], [0, 1], clamp);
  const saveIn = enter(144, 90);
  const saveAmt = m.hook[0].price - m.hook[low].price;
  const saveVal = Math.round(interpolate(frame, [146, 180], [0, saveAmt], clamp));

  return (
    <SceneShell theme={t}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, padding: "0 120px" }}>
        <div style={{ opacity: head, transform: `translateY(${interpolate(head, [0, 1], [24, 0])}px)`, fontFamily: DISPLAY, fontSize: 74, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink, textAlign: "center", lineHeight: 1.05 }}>
          Before you buy it, <span style={{ color: t.green }}>find it for less.</span>
        </div>

        <div style={{ opacity: chip, transform: `scale(${interpolate(chip, [0, 1], [0.85, 1])})`, display: "flex", alignItems: "center", gap: 14, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "13px 24px", color: t.inkSub, fontSize: 27, fontWeight: 600 }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background: t.green, boxShadow: `0 0 16px ${t.green}` }} />
          {m.product}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 13, width: 760 }}>
          {m.hook.map((s, i) => {
            const rin = enter(44 + i * 11);
            const isLow = i === low;
            const dim = isLow ? 1 : interpolate(hi, [0, 1], [1, 0.34]);
            const lift = isLow ? interpolate(hi, [0, 1], [1, 1.05]) : 1;
            return (
              <div key={s.store} style={{ opacity: interpolate(rin, [0, 1], [0, 1]) * dim, transform: `translateX(${interpolate(rin, [0, 1], [46, 0])}px) scale(${lift})`, display: "flex", alignItems: "center", justifyContent: "space-between", background: t.surface, border: `1.5px solid ${isLow ? t.green : t.border}`, borderRadius: 16, padding: "19px 28px" }}>
                <span style={{ color: t.ink, fontSize: 30, fontWeight: 600, display: "flex", alignItems: "center", gap: 14 }}>
                  {s.store}
                  {isLow && hi > 0.4 && <span style={{ opacity: interpolate(hi, [0.4, 1], [0, 1], clamp), background: t.green, color: BADGE_INK, fontSize: 16, fontWeight: 800, padding: "4px 11px", borderRadius: 99 }}>LOWEST</span>}
                </span>
                <span style={{ fontSize: 33, fontWeight: 800, color: isLow && hi > 0.4 ? t.green : t.ink, fontVariantNumeric: "tabular-nums" }}>{money(m, s.price)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ opacity: interpolate(saveIn, [0, 1], [0, 1]), transform: `translateY(${interpolate(saveIn, [0, 1], [20, 0])}px)`, display: "flex", alignItems: "baseline", gap: 14, marginTop: 4 }}>
          <span style={{ color: t.inkSub, fontSize: 32, fontWeight: 600 }}>You save</span>
          <span style={{ fontFamily: DISPLAY, color: t.green, fontSize: 58, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{money(m, saveVal)}</span>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
