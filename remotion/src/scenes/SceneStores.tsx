import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { DISPLAY } from "../fonts";
import { SceneShell, useEnter, Eyebrow, type Ctx } from "./_common";

/* Scene 5 — the breadth showcase (req 12). Big "1,500+ stores worldwide"
   + a wrap of real store names for the market. */
export const SceneStores: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const { theme: t, market: m } = ctx;
  useCurrentFrame();
  const enter = useEnter();
  const eb = enter(2);
  const num = enter(12, 80);
  const sub = enter(24);

  return (
    <SceneShell theme={t}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 110px" }}>
        <Eyebrow theme={t} opacity={eb}>Searched on Havlo</Eyebrow>

        <span style={{ opacity: num, transform: `scale(${interpolate(num, [0, 1], [0.8, 1])})`, fontFamily: DISPLAY, fontSize: 156, fontWeight: 800, letterSpacing: "-0.04em", color: t.green, lineHeight: 1 }}>
          1,500+
        </span>
        <div style={{ opacity: sub, fontFamily: DISPLAY, fontSize: 46, fontWeight: 700, color: t.ink }}>
          stores worldwide, across 6 countries
        </div>

        <div style={{ opacity: sub, display: "flex", gap: 18, fontSize: 50, lineHeight: 1, marginTop: 2 }}>
          {["🇳🇬", "🇬🇧", "🇺🇸", "🇮🇳", "🇿🇦", "🇦🇪"].map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 13, maxWidth: 1240, marginTop: 14 }}>
          {m.roster.map((name, i) => {
            const cin = enter(46 + i * 6);
            return (
              <span key={name} style={{ opacity: interpolate(cin, [0, 1], [0, 1]), transform: `translateY(${interpolate(cin, [0, 1], [14, 0])}px)`, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 99, padding: "12px 24px", color: t.inkSub, fontSize: 26, fontWeight: 600 }}>
                {name}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
