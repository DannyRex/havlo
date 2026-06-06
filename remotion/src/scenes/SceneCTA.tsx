import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { SceneShell, useEnter, type Ctx } from "./_common";
import { HavloLockup } from "../Logo";
import { DISPLAY } from "../fonts";

/* Scene 7 — the close. Real silver-metal logo + the new primary tagline
   "Shop smarter." + havlo.io. */
export const SceneCTA: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const { theme: t } = ctx;
  const enter = useEnter();
  const logo = enter(4, 130);
  const tag = enter(20);
  const url = enter(34);

  return (
    <SceneShell theme={t}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <div style={{ opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.85, 1])})` }}>
          <HavloLockup theme={t} size={100} />
        </div>

        <div style={{ opacity: tag, transform: `translateY(${interpolate(tag, [0, 1], [16, 0])}px)`, fontFamily: DISPLAY, fontSize: 64, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink }}>
          Shop <span style={{ color: t.green }}>smarter.</span>
        </div>

        <div style={{ opacity: url, transform: `translateY(${interpolate(url, [0, 1], [14, 0])}px)`, display: "inline-flex", alignItems: "center", gap: 14, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 99, padding: "15px 30px", color: t.ink, fontSize: 30, fontWeight: 700 }}>
          <span style={{ position: "relative", display: "inline-flex", width: 14, height: 14 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: 99, background: t.green, opacity: 0.5 }} />
            <span style={{ position: "relative", width: 14, height: 14, borderRadius: 99, background: t.green }} />
          </span>
          havlo.io
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
