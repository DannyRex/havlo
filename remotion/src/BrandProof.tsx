import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { THEMES, STORES_LABEL, type ThemeName } from "./brand";
import { HavloLockup } from "./Logo";
import { SANS, DISPLAY } from "./fonts";

/* Corrected brand card — also the new CTA/end scene. Real silver-metal
   logo, deal-green accent, real Hero headline. Renders in either theme
   via the `theme` prop. Proves reqs 7/8 (green + real logo, no blue). */
export const BrandProof: React.FC<{ theme: ThemeName }> = ({ theme: themeName }) => {
  const t = THEMES[themeName];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (s: number) => spring({ frame: frame - s, fps, config: { damping: 18, mass: 0.7, stiffness: 110 } });
  const logo = enter(4);
  const head = enter(20);
  const pill = enter(38);

  return (
    <AbsoluteFill style={{ background: t.bg, fontFamily: SANS, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(1150px 620px at 50% -10%, ${t.glow}, transparent 70%)` }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <div style={{ opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.85, 1])})` }}>
          <HavloLockup theme={t} size={92} />
        </div>

        <div
          style={{
            opacity: head,
            transform: `translateY(${interpolate(head, [0, 1], [18, 0])}px)`,
            fontFamily: DISPLAY,
            fontSize: 70,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: t.ink,
            textAlign: "center",
            lineHeight: 1.05,
          }}
        >
          Before you buy it,{" "}
          <span style={{ color: t.green }}>find it for less.</span>
        </div>

        <div
          style={{
            opacity: pill,
            transform: `translateY(${interpolate(pill, [0, 1], [14, 0])}px)`,
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 99,
            padding: "15px 30px",
            color: t.ink,
            fontSize: 29,
            fontWeight: 700,
          }}
        >
          <span style={{ position: "relative", display: "inline-flex", width: 14, height: 14 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: 99, background: t.green, opacity: 0.5 }} />
            <span style={{ position: "relative", width: 14, height: 14, borderRadius: 99, background: t.green }} />
          </span>
          havlo.io
          <span style={{ color: t.inkFaint, fontWeight: 500, fontSize: 23 }}>
            · {STORES_LABEL}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
