import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { THEMES } from "./brand";
import { DISPLAY, SANS } from "./fonts";
import { HavloLockup } from "./Logo";

/* ──────────────────────────────────────────────────────────────────
   CursorJourney — "Ways to dupe"-style demo over REAL havlo.io
   screenshots (the green live site). A persistent browser frame; the
   cursor drives a real session:
     home → search autocomplete (MacBook Air M4 · 4 stores) → the live
     4-store compare view (eBay cheapest) → "Shop smarter." end card.

   Screens are actual captures (remotion/public/screens). Cursor targets
   are window-relative; tweak the fractions if a target drifts.
   ────────────────────────────────────────────────────────────────── */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Browser window — content matches the 1600x950 capture aspect (~1.684)
const FRAME = { x: 210, y: 66, w: 1500, chrome: 56, contentH: 891 };
const FRAME_H = FRAME.chrome + FRAME.contentH;
// content-fraction → window-relative coords
const fx = (f: number) => f * FRAME.w;
const fy = (f: number) => FRAME.chrome + f * FRAME.contentH;

const Cursor: React.FC<{ x: number; y: number; press: number; green: string }> = ({ x, y, press, green }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: 30, transform: `scale(${interpolate(press, [0, 1], [1, 0.82])})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 4px 7px rgba(0,0,0,0.4))" }}>
    {press > 0.05 && <span style={{ position: "absolute", left: 8, top: 6, width: 32, height: 32, marginLeft: -16, marginTop: -16, borderRadius: 99, border: `3px solid ${green}`, opacity: interpolate(press, [0, 0.5, 1], [0, 0.7, 0]), transform: `scale(${interpolate(press, [0, 1], [0.4, 1.8])})` }} />}
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M4 2 L4 18.6 L8.3 14.5 L11.2 21 L13.8 19.85 L10.95 13.5 L16.7 13.5 Z" fill="#16181d" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>
  </div>
);

const Screen: React.FC<{ src: string; opacity: number }> = ({ src, opacity }) => (
  <AbsoluteFill style={{ opacity }}>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
  </AbsoluteFill>
);

export const CursorJourney: React.FC = () => {
  const t = THEMES.light;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // cursor path through the screens (window-relative)
  const start = { x: FRAME.w - 140, y: FRAME.contentH };
  const targets = [
    { at: 16,  x: fx(0.50), y: fy(0.66) }, // home: search composer
    { at: 92,  x: fx(0.42), y: fy(0.71) }, // home-search: MacBook Air M4 row (1st suggestion)
    { at: 184, x: fx(0.42), y: fy(0.675) }, // compare: cheapest (eBay) row
  ];
  let cx = start.x, cy = start.y, px = start.x, py = start.y;
  for (const tg of targets) {
    const p = spring({ frame: frame - tg.at, fps, config: { damping: 22, mass: 1, stiffness: 78 } });
    cx += (tg.x - px) * p; cy += (tg.y - py) * p; px = tg.x; py = tg.y;
  }
  const clickComposer = interpolate(frame, [48, 54, 62], [0, 1, 0], clamp);
  const clickSugg = interpolate(frame, [132, 138, 146], [0, 1, 0], clamp);
  const press = Math.max(clickComposer, clickSugg);

  // screen cross-fades
  const homeOp = interpolate(frame, [0, 1, 66, 76], [1, 1, 1, 0], clamp);
  const searchOp = interpolate(frame, [64, 74, 156, 166], [0, 1, 1, 0], clamp);
  const compareOp = interpolate(frame, [156, 166], [0, 1], clamp);
  const endOp = interpolate(frame, [430, 452], [0, 1], clamp);
  const url = frame < 160 ? "havlo.io" : "havlo.io/compare";

  // gentle zoom-in on the compare payoff
  const zoom = interpolate(frame, [166, 430], [1, 1.05], clamp);

  return (
    <AbsoluteFill style={{ background: t.surface2, fontFamily: SANS }}>
      <div style={{ position: "absolute", left: FRAME.x, top: FRAME.y, width: FRAME.w, height: FRAME_H, borderRadius: 18, overflow: "hidden", background: t.bg, border: `1px solid ${t.border}`, boxShadow: "0 40px 90px rgba(15,23,42,0.20)", isolation: "isolate" }}>
        {/* browser chrome */}
        <div style={{ height: FRAME.chrome, display: "flex", alignItems: "center", gap: 20, padding: "0 22px", background: "#EEF1F5", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", gap: 10 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c }} />)}</div>
          <div style={{ flex: 1, height: 32, borderRadius: 8, background: "#fff", border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.inkFaint, fontSize: 17, fontWeight: 500 }}>{url}</div>
        </div>

        {/* page content (real screenshots) */}
        <div style={{ position: "absolute", top: FRAME.chrome, left: 0, width: FRAME.w, height: FRAME.contentH, transform: `scale(${zoom})`, transformOrigin: "50% 64%" }}>
          <Screen src="screens/home.png" opacity={homeOp} />
          <Screen src="screens/home-search.png" opacity={searchOp} />
          <Screen src="screens/compare.png" opacity={compareOp} />
        </div>

        <Cursor x={cx} y={cy} press={press} green={t.green} />
      </div>

      {/* end card */}
      {endOp > 0.01 && (
        <AbsoluteFill style={{ background: t.bg, opacity: endOp, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
          <HavloLockup theme={t} size={92} />
          <div style={{ fontFamily: DISPLAY, fontSize: 62, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink }}>Shop <span style={{ color: t.green }}>smarter.</span></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 99, padding: "13px 28px", color: t.ink, fontSize: 28, fontWeight: 700 }}>
            <span style={{ width: 12, height: 12, borderRadius: 99, background: t.green }} />havlo.io
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
