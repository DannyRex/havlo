import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { DISPLAY } from "../fonts";
import { SceneShell, useEnter, type Ctx } from "./_common";

/* Scene 6 — cashback. Real Cashback section copy, kept honest as
   "coming soon" (it's a pre-launch waitlist). */
export const SceneCashback: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const { theme: t } = ctx;
  const enter = useEnter();
  const eb = enter(2);
  const head = enter(14);
  const rate = enter(32, 90);
  const note = enter(48);

  return (
    <SceneShell theme={t}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: "0 120px" }}>
        <div style={{ opacity: eb, display: "inline-flex", alignItems: "center", gap: 10, background: t.greenSoft, border: `1px solid ${t.green}`, borderRadius: 99, padding: "9px 22px" }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background: t.green }} />
          <span style={{ color: t.green, fontSize: 20, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Cashback · coming soon</span>
        </div>

        <div style={{ opacity: head, transform: `translateY(${interpolate(head, [0, 1], [18, 0])}px)`, fontFamily: DISPLAY, fontSize: 54, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink, textAlign: "center", maxWidth: 1200, lineHeight: 1.08 }}>
          Money back to your bank, <span style={{ color: t.green }}>every time you shop.</span>
        </div>

        <div style={{ opacity: rate, transform: `scale(${interpolate(rate, [0, 1], [0.85, 1])})`, display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
          <span style={{ color: t.inkSub, fontSize: 32, fontWeight: 600 }}>Up to</span>
          <span style={{ fontFamily: DISPLAY, color: t.green, fontSize: 92, fontWeight: 800, lineHeight: 1 }}>5%</span>
          <span style={{ color: t.inkSub, fontSize: 32, fontWeight: 600 }}>back</span>
        </div>

        <div style={{ opacity: note, color: t.inkFaint, fontSize: 26, fontWeight: 500 }}>
          on select stores when you shop through Havlo
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
