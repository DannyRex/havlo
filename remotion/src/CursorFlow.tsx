import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { THEMES, type ThemeName } from "./brand";
import { DISPLAY, SANS } from "./fonts";
import { HavloLockup } from "./Logo";

/* ──────────────────────────────────────────────────────────────────
   CursorFlow — "Ways to dupe"-style demo over REAL havlo.io screenshots,
   walking the actual product-discovery chain:

     search (MacBook Air M4 · 4 stores)
       → PDP  (price spectrum + price-history chart)
       → "Compare prices across 4 stores"
       → live 4-store compare (eBay £522 cheapest)
       → "Shop smarter." end card

   Parameterized by {device, theme}:
     • desktop → 1920×1080 landscape, browser chrome, arrow cursor
     • mobile  → 1080×1920 portrait, phone chrome, tap-ripple

   All geometry below is FRAME-LOCAL (origin = top-left inside the device
   frame's border). Cursor targets are page fractions so one timeline
   drives both themes; tweak FRAC if a target drifts.
   ────────────────────────────────────────────────────────────────── */

export type Device = "desktop" | "mobile";
export type CursorFlowProps = { device: Device; theme: ThemeName };
export const CURSORFLOW_DURATION = 516;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* Capture dimensions (CSS px). pdpH = tall PDP capture height. */
const CAP = {
  desktop: { vw: 1600, vh: 950, pdpH: 1406 },
  mobile: { vw: 390, vh: 844, pdpH: 1770 },
} as const;

/* Cursor targets. Non-PDP screens: fraction of viewport (vw×vh).
   PDP: fraction of the tall image (vw×pdpH). */
const FRAC = {
  desktop: {
    suggestion: { x: 0.34, y: 0.715 }, // home autocomplete: "MacBook Air M4" row
    spectrum: { x: 0.66, y: 0.442 }, // pdp "Lowest price" spectrum bar
    chart: { x: 0.5, y: 0.778 }, // pdp price-history line
    cta: { x: 0.675, y: 0.342 }, // pdp "Compare prices across 4 stores"
    row: { x: 0.42, y: 0.675 }, // compare eBay cheapest row
  },
  mobile: {
    suggestion: { x: 0.42, y: 0.71 },
    spectrum: { x: 0.5, y: 0.575 },
    chart: { x: 0.5, y: 0.82 },
    cta: { x: 0.5, y: 0.46 },
    row: { x: 0.42, y: 0.86 },
  },
} as const;

/* PDP vertical scroll (CSS px) at each beat. Desktop fits hero+spectrum+CTA
   at the top, so only the chart needs scrolling. */
const SCROLL = {
  desktop: { spectrum: 0, chart: 456, cta: 0 },
  mobile: { spectrum: 600, chart: 926, cta: 388 },
} as const;

function geom(device: Device, canvasW: number, canvasH: number) {
  const { vw, vh, pdpH } = CAP[device];
  if (device === "desktop") {
    const scale = 1.0, chrome = 54, bezel = 0;
    const contentW = vw * scale, contentH = vh * scale;
    const frameW = contentW, frameH = chrome + contentH;
    return { vw, vh, pdpH, scale, chrome, statusH: 0, urlH: 0, bezel, contentW, contentH, frameW, frameH, frameX: (canvasW - frameW) / 2, frameY: (canvasH - frameH) / 2, cLeft: 0, cTop: chrome };
  }
  const scale = 1.795, statusH = 46, urlH = 56, bezel = 15;
  const contentW = vw * scale, contentH = vh * scale;
  const frameW = contentW + 2 * bezel, frameH = 2 * bezel + statusH + urlH + contentH;
  return { vw, vh, pdpH, scale, chrome: 0, statusH, urlH, bezel, contentW, contentH, frameW, frameH, frameX: (canvasW - frameW) / 2, frameY: (canvasH - frameH) / 2, cLeft: 0, cTop: statusH + urlH };
}

const ArrowCursor: React.FC<{ x: number; y: number; press: number; green: string }> = ({ x, y, press, green }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: 40, transform: `scale(${interpolate(press, [0, 1], [1, 0.82])})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 5px 9px rgba(0,0,0,0.4))" }}>
    {press > 0.05 && <span style={{ position: "absolute", left: 8, top: 6, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 99, border: `3px solid ${green}`, opacity: interpolate(press, [0, 0.5, 1], [0, 0.7, 0]), transform: `scale(${interpolate(press, [0, 1], [0.4, 1.9])})` }} />}
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M4 2 L4 18.6 L8.3 14.5 L11.2 21 L13.8 19.85 L10.95 13.5 L16.7 13.5 Z" fill="#16181d" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>
  </div>
);

const TapDot: React.FC<{ x: number; y: number; press: number; green: string }> = ({ x, y, press, green }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: 40, transform: "translate(-50%,-50%)" }}>
    {press > 0.05 && <span style={{ position: "absolute", left: "50%", top: "50%", width: 96, height: 96, marginLeft: -48, marginTop: -48, borderRadius: 99, border: `4px solid ${green}`, opacity: interpolate(press, [0, 0.5, 1], [0, 0.6, 0]), transform: `scale(${interpolate(press, [0, 1], [0.3, 1.7])})` }} />}
    <span style={{ display: "block", width: 48, height: 48, borderRadius: 99, background: "rgba(15,23,42,0.28)", border: "2.5px solid rgba(255,255,255,0.88)", boxShadow: "0 4px 12px rgba(0,0,0,0.28)", transform: `scale(${interpolate(press, [0, 1], [1, 0.8])})` }} />
  </div>
);

export const CursorFlow: React.FC<CursorFlowProps> = ({ device, theme }) => {
  const t = THEMES[theme];
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const g = geom(device, width, height);
  const f = FRAC[device];
  const sc = SCROLL[device];
  const isM = device === "mobile";
  const dir = `${device}-${theme}`;

  /* PDP scroll (CSS px) across the beats */
  const scroll = interpolate(frame, [80, 116, 168, 210, 262, 300], [0, sc.spectrum, sc.spectrum, sc.chart, sc.chart, sc.cta], clamp);

  /* frame-local on-screen helpers */
  const onView = (p: { x: number; y: number }) => ({ x: g.cLeft + p.x * g.contentW, y: g.cTop + p.y * g.contentH });
  const onPdp = (p: { x: number; y: number }, s: number) => ({ x: g.cLeft + p.x * g.vw * g.scale, y: g.cTop + (p.y * g.pdpH - s) * g.scale });

  /* cursor path — accumulated springs through frame-local targets */
  const start = { x: g.cLeft + g.contentW * 0.78, y: g.cTop + g.contentH * 1.04 };
  const targets = [
    { at: 16, ...onView(f.suggestion) },
    { at: 100, ...onPdp(f.spectrum, sc.spectrum) },
    { at: 196, ...onPdp(f.chart, sc.chart) },
    { at: 286, ...onPdp(f.cta, sc.cta) },
    { at: 350, ...onView(f.row) },
  ];
  let cx = start.x, cy = start.y, px = start.x, py = start.y;
  for (const tg of targets) {
    const p = spring({ frame: frame - tg.at, fps, config: { damping: 24, mass: 1, stiffness: 80 } });
    cx += (tg.x - px) * p; cy += (tg.y - py) * p; px = tg.x; py = tg.y;
  }
  const tapHome = interpolate(frame, [50, 57, 66], [0, 1, 0], clamp);
  const clickCta = interpolate(frame, [306, 313, 322], [0, 1, 0], clamp);
  const press = Math.max(tapHome, clickCta);

  /* screen cross-fades */
  const homeOp = interpolate(frame, [0, 1, 68, 80], [1, 1, 1, 0], clamp);
  const pdpOp = interpolate(frame, [70, 82, 320, 332], [0, 1, 1, 0], clamp);
  const compareOp = interpolate(frame, [322, 334], [0, 1], clamp);
  const endOp = interpolate(frame, [436, 460], [0, 1], clamp);

  const url = frame < 76 ? "havlo.io/uk" : frame < 326 ? "havlo.io/uk/p/macbook-air-m4" : "havlo.io/uk/compare";

  const ViewShot: React.FC<{ name: string; opacity: number }> = ({ name, opacity }) => (
    <div style={{ position: "absolute", left: g.cLeft, top: g.cTop, width: g.contentW, height: g.contentH, overflow: "hidden", opacity }}>
      <Img src={staticFile(`screens/${dir}/${name}.png`)} style={{ width: g.contentW, height: g.contentH, objectFit: "cover", objectPosition: "top" }} />
    </div>
  );

  return (
    <AbsoluteFill style={{ background: t.surface2, fontFamily: SANS }}>
      <div style={{ position: "absolute", left: g.frameX, top: g.frameY, width: g.frameW, height: g.frameH, borderRadius: isM ? 58 : 18, overflow: "hidden", background: t.bg, border: isM ? `${g.bezel}px solid #0c0e12` : `1px solid ${t.border}`, boxShadow: isM ? "0 50px 120px rgba(15,23,42,0.34)" : "0 40px 95px rgba(15,23,42,0.20)", isolation: "isolate", boxSizing: "border-box" }}>
        {isM ? (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, width: g.contentW, height: g.statusH, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 34px", background: t.bg, color: t.ink, fontSize: 23, fontWeight: 600 }}>
              <span>9:41</span>
              <span style={{ width: 26, height: 14, borderRadius: 4, border: `2px solid ${t.ink}`, opacity: 0.85, position: "relative" }}><span style={{ position: "absolute", left: 2, top: 2, bottom: 2, width: "62%", background: t.green, borderRadius: 1.5 }} /></span>
            </div>
            <div style={{ position: "absolute", top: g.statusH, left: 0, width: g.contentW, height: g.urlH, display: "flex", alignItems: "center", justifyContent: "center", background: t.bg }}>
              <div style={{ width: "84%", height: 40, borderRadius: 12, background: t.surface2, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, color: t.inkFaint, fontSize: 21, fontWeight: 500 }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: t.green }} />{url}
              </div>
            </div>
          </>
        ) : (
          <div style={{ height: g.chrome, display: "flex", alignItems: "center", gap: 20, padding: "0 22px", background: theme === "dark" ? "#181B22" : "#EEF1F5", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", gap: 10 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c }} />)}</div>
            <div style={{ flex: 1, height: 32, borderRadius: 8, background: t.bg, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.inkFaint, fontSize: 17, fontWeight: 500 }}>{url}</div>
          </div>
        )}

        <ViewShot name="home" opacity={homeOp} />
        <ViewShot name="compare" opacity={compareOp} />
        <div style={{ position: "absolute", left: g.cLeft, top: g.cTop, width: g.contentW, height: g.contentH, overflow: "hidden", opacity: pdpOp }}>
          <Img src={staticFile(`screens/${dir}/pdp-full.png`)} style={{ position: "absolute", top: 0, left: 0, width: g.contentW, height: g.pdpH * g.scale, transform: `translateY(${-scroll * g.scale}px)` }} />
        </div>

        {isM
          ? <TapDot x={cx} y={cy} press={press} green={t.green} />
          : <ArrowCursor x={cx} y={cy} press={press} green={t.green} />}
      </div>

      {isM && <div style={{ position: "absolute", left: width / 2 - 70, top: g.frameY + g.frameH - 26, width: 140, height: 7, borderRadius: 99, background: t.ink, opacity: 0.5 }} />}

      {endOp > 0.01 && (
        <AbsoluteFill style={{ background: t.bg, opacity: endOp, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: isM ? 40 : 30 }}>
          <HavloLockup theme={t} size={isM ? 108 : 96} />
          <div style={{ fontFamily: DISPLAY, fontSize: isM ? 84 : 64, fontWeight: 800, letterSpacing: "-0.03em", color: t.ink }}>Shop <span style={{ color: t.green }}>smarter.</span></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 13, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 99, padding: isM ? "16px 34px" : "13px 28px", color: t.ink, fontSize: isM ? 34 : 28, fontWeight: 700 }}>
            <span style={{ width: 13, height: 13, borderRadius: 99, background: t.green }} />havlo.io
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
