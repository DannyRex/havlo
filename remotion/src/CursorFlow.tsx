import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, spring, interpolate, useVideoConfig } from "remotion";
import { THEMES, type ThemeName } from "./brand";
import { DISPLAY, SANS } from "./fonts";
import { HavloLockup } from "./Logo";

/* ──────────────────────────────────────────────────────────────────
   CursorFlow — "Ways to dupe"-style demo over REAL havlo.io screenshots,
   walking the actual product-discovery chain:

     search (MacBook Air M4)
       → PDP  (price spectrum + price-history chart)
       → "Compare prices across N stores"
       → live compare (cheapest first)
       → "Shop smarter." end card

   Parameterized by {country, device, theme}:
     • desktop → 1920×1080 landscape, browser chrome, arrow cursor
     • mobile  → 1080×1920 portrait, phone chrome, tap-ripple
     • country → uk (£) / ng (₦) / us ($), real local stores + currency

   Screens are authentic captures (remotion/public/screens/<country>/
   <device>-<theme>). All geometry is FRAME-LOCAL.

   Anti-flicker: screen rendering is a module-scoped <Shot> (NOT defined
   in render — a nested component remounts the <Img> every frame and
   flickers); cross-fades keep the incoming layer over a fully-opaque
   outgoing one (no background bleed-through); scroll offsets are rounded
   to whole pixels; mobile renders the dsf2 capture 1:1 (no resample).
   ────────────────────────────────────────────────────────────────── */

export type Device = "desktop" | "mobile";
export type Country = "uk" | "ng" | "us";
export type CursorFlowProps = { country: Country; device: Device; theme: ThemeName };
export const CURSORFLOW_DURATION = 516;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const CAP = { desktop: { vw: 1600, vh: 950 }, mobile: { vw: 390, vh: 844 } } as const;

/* Tall PDP capture heights (CSS px) per country × device. */
const PDP_H: Record<Country, Record<Device, number>> = {
  uk: { desktop: 1406, mobile: 1770 },
  ng: { desktop: 1406, mobile: 1770 },
  us: { desktop: 1333, mobile: 1660 },
};
const COMPARE_FULL_H = 1500; // mobile compare-full clip height (all countries)
const COMPARE_SCROLL = 300; // mobile compare scroll (CSS px) — rolls the store rows up

/* Cursor targets. Non-PDP/compare screens use viewport fractions (vw×vh).
   PDP uses fractions of the tall image (vw×pdpH). Mobile compare uses a
   fraction of compare-full (vw×COMPARE_FULL_H). */
const FRAC = {
  desktop: {
    suggestion: { x: 0.34, y: 0.715 }, // home autocomplete "MacBook Air M4" row
    spectrum: { x: 0.8, y: 0.442 }, // pdp spectrum: priciest (rightmost) dot — its store+price tooltip reveals
    chart: { x: 0.5, y: 0.778 }, // pdp price-history line
    cta: { x: 0.675, y: 0.342 }, // pdp "Compare prices across N stores"
    row: { x: 0.42, y: 0.675 }, // compare cheapest row (viewport frac)
  },
  mobile: {
    suggestion: { x: 0.42, y: 0.60 },
    spectrum: { x: 0.85, y: 0.575 }, // priciest (rightmost) dot — tap reveals its store+price
    chart: { x: 0.5, y: 0.82 },
    cta: { x: 0.5, y: 0.46 },
    row: { x: 0.42, y: 0.378 }, // compare-full cheapest (eBay) row (image frac)
  },
} as const;

function geom(device: Device, canvasW: number, canvasH: number) {
  const { vw, vh } = CAP[device];
  if (device === "desktop") {
    const scale = 1.0, chrome = 54;
    const contentW = vw * scale, contentH = vh * scale;
    const frameW = contentW, frameH = chrome + contentH;
    return { vw, vh, scale, chrome, statusH: 0, urlH: 0, bezel: 0, contentW, contentH, frameW, frameH, frameX: (canvasW - frameW) / 2, frameY: (canvasH - frameH) / 2, cLeft: 0, cTop: chrome };
  }
  const scale = 2.0, statusH = 50, urlH = 58, bezel = 16; // dsf2 source rendered 1:1
  const contentW = vw * scale, contentH = vh * scale;
  const frameW = contentW + 2 * bezel, frameH = 2 * bezel + statusH + urlH + contentH;
  return { vw, vh, scale, chrome: 0, statusH, urlH, bezel, contentW, contentH, frameW, frameH, frameX: (canvasW - frameW) / 2, frameY: (canvasH - frameH) / 2, cLeft: 0, cTop: statusH + urlH };
}

/* Module-scoped screen tile (clipped window + translatable image). */
const Shot: React.FC<{ src: string; left: number; top: number; winW: number; winH: number; imgH: number; ty: number; opacity: number }> = ({ src, left, top, winW, winH, imgH, ty, opacity }) => (
  <div style={{ position: "absolute", left, top, width: winW, height: winH, overflow: "hidden", opacity }}>
    <Img src={staticFile(src)} style={{ position: "absolute", top: 0, left: 0, width: winW, height: imgH, transform: `translateY(${ty}px)`, willChange: "transform", backfaceVisibility: "hidden" }} />
  </div>
);

const ArrowCursor: React.FC<{ x: number; y: number; press: number; green: string }> = ({ x, y, press, green }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: 40, transform: `scale(${interpolate(press, [0, 1], [1, 0.82])})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 5px 9px rgba(0,0,0,0.4))" }}>
    {press > 0.05 && <span style={{ position: "absolute", left: 8, top: 6, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 99, border: `3px solid ${green}`, opacity: interpolate(press, [0, 0.5, 1], [0, 0.7, 0]), transform: `scale(${interpolate(press, [0, 1], [0.4, 1.9])})` }} />}
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M4 2 L4 18.6 L8.3 14.5 L11.2 21 L13.8 19.85 L10.95 13.5 L16.7 13.5 Z" fill="#16181d" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>
  </div>
);

const TapDot: React.FC<{ x: number; y: number; press: number; green: string }> = ({ x, y, press, green }) => (
  <div style={{ position: "absolute", left: x, top: y, zIndex: 40, transform: "translate(-50%,-50%)" }}>
    {press > 0.05 && <span style={{ position: "absolute", left: "50%", top: "50%", width: 100, height: 100, marginLeft: -50, marginTop: -50, borderRadius: 99, border: `4px solid ${green}`, opacity: interpolate(press, [0, 0.5, 1], [0, 0.6, 0]), transform: `scale(${interpolate(press, [0, 1], [0.3, 1.7])})` }} />}
    <span style={{ display: "block", width: 50, height: 50, borderRadius: 99, background: "rgba(15,23,42,0.26)", border: "3px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 13px rgba(0,0,0,0.3)", transform: `scale(${interpolate(press, [0, 1], [1, 0.8])})` }} />
  </div>
);

export const CursorFlow: React.FC<CursorFlowProps> = ({ country, device, theme }) => {
  const t = THEMES[theme];
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const g = geom(device, width, height);
  const f = FRAC[device];
  const isM = device === "mobile";
  const dir = `${country}/${device}-${theme}`;
  const pdpH = PDP_H[country][device];
  const pdpMax = pdpH - g.vh;
  const center = (fr: number) => Math.max(0, Math.min(fr * pdpH - 0.45 * g.vh, pdpMax));

  /* PDP scroll targets (CSS px). Desktop fits hero+spectrum+CTA up top;
     only the chart needs a scroll. Mobile scrolls to each section. */
  const pS = isM
    ? { spectrum: center(f.spectrum.y), chart: pdpMax, cta: center(f.cta.y) }
    : { spectrum: 0, chart: pdpMax, cta: 0 };

  const scroll = interpolate(frame, [82, 120, 170, 215, 265, 305], [0, pS.spectrum, pS.spectrum, pS.chart, pS.chart, pS.cta], clamp);
  const cmpScroll = isM ? interpolate(frame, [342, 392], [0, COMPARE_SCROLL], clamp) : 0;

  /* frame-local on-screen helpers */
  const onView = (p: { x: number; y: number }) => ({ x: g.cLeft + p.x * g.contentW, y: g.cTop + p.y * g.contentH });
  const onTall = (p: { x: number; y: number }, imgCss: number, s: number) => ({ x: g.cLeft + p.x * g.contentW, y: g.cTop + (p.y * imgCss - s) * g.scale });

  const start = { x: g.cLeft + g.contentW * 0.78, y: g.cTop + g.contentH * 1.04 };
  const rowTarget = isM ? onTall(f.row, COMPARE_FULL_H, COMPARE_SCROLL) : onView(f.row);
  const targets = [
    { at: 16, ...onView(f.suggestion) },
    { at: 106, ...onTall(f.spectrum, pdpH, pS.spectrum) },
    { at: 200, ...onTall(f.chart, pdpH, pS.chart) },
    { at: 290, ...onTall(f.cta, pdpH, pS.cta) },
    { at: 356, ...rowTarget },
  ];
  let cx = start.x, cy = start.y, px = start.x, py = start.y;
  for (const tg of targets) {
    const p = spring({ frame: frame - tg.at, fps, config: { damping: 24, mass: 1, stiffness: 80 } });
    cx += (tg.x - px) * p; cy += (tg.y - py) * p; px = tg.x; py = tg.y;
  }
  const tapHome = interpolate(frame, [50, 57, 66], [0, 1, 0], clamp);
  const tapSpectrum = isM ? interpolate(frame, [132, 139, 149], [0, 1, 0], clamp) : 0; // mobile taps a dot to reveal its price
  const clickCta = interpolate(frame, [306, 313, 322], [0, 1, 0], clamp);
  const press = Math.max(tapHome, tapSpectrum, clickCta);
  /* reveal the priciest store's price tooltip (pdp-hover) while the cursor is on the dot */
  const pdpHoverOp = interpolate(frame, [132, 144, 188, 198], [0, 1, 1, 0], clamp);

  /* cross-fades — incoming over fully-opaque outgoing, no bg bleed */
  const homeOp = interpolate(frame, [0, 83, 84], [1, 1, 0], clamp);
  const pdpOp = interpolate(frame, [70, 82, 320, 332], [0, 1, 1, 0], clamp);
  const compareOp = frame < 318 ? 0 : 1;
  const endOp = interpolate(frame, [440, 464], [0, 1], clamp);

  const url = frame < 76 ? `havlo.io/${country}` : frame < 326 ? `havlo.io/${country}/p/macbook-air-m4` : `havlo.io/${country}/compare`;
  const round = (px2: number) => Math.round(px2);

  return (
    <AbsoluteFill style={{ background: t.surface2, fontFamily: SANS }}>
      <div style={{ position: "absolute", left: g.frameX, top: g.frameY, width: g.frameW, height: g.frameH, borderRadius: isM ? 60 : 18, overflow: "hidden", background: t.bg, border: isM ? `${g.bezel}px solid #0c0e12` : `1px solid ${t.border}`, boxShadow: isM ? "0 50px 120px rgba(15,23,42,0.34)" : "0 40px 95px rgba(15,23,42,0.20)", isolation: "isolate", boxSizing: "border-box" }}>
        {isM ? (
          <>
            <div style={{ position: "absolute", top: 0, left: 0, width: g.contentW, height: g.statusH, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 38px", background: t.bg, color: t.ink, fontSize: 25, fontWeight: 600 }}>
              <span>9:41</span>
              <span style={{ width: 28, height: 15, borderRadius: 4, border: `2px solid ${t.ink}`, opacity: 0.85, position: "relative" }}><span style={{ position: "absolute", left: 2, top: 2, bottom: 2, width: "62%", background: t.green, borderRadius: 1.5 }} /></span>
            </div>
            <div style={{ position: "absolute", top: g.statusH, left: 0, width: g.contentW, height: g.urlH, display: "flex", alignItems: "center", justifyContent: "center", background: t.bg }}>
              <div style={{ width: "84%", height: 42, borderRadius: 13, background: t.surface2, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: t.inkFaint, fontSize: 22, fontWeight: 500 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: t.green }} />{url}
              </div>
            </div>
          </>
        ) : (
          <div style={{ height: g.chrome, display: "flex", alignItems: "center", gap: 20, padding: "0 22px", background: theme === "dark" ? "#181B22" : "#EEF1F5", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: "flex", gap: 10 }}>{["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 99, background: c }} />)}</div>
            <div style={{ flex: 1, height: 32, borderRadius: 8, background: t.bg, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.inkFaint, fontSize: 17, fontWeight: 500 }}>{url}</div>
          </div>
        )}

        <Shot src={`screens/${dir}/home.png`} left={g.cLeft} top={g.cTop} winW={g.contentW} winH={g.contentH} imgH={g.contentH} ty={0} opacity={homeOp} />
        <Shot src={`screens/${dir}/${isM ? "compare-full" : "compare"}.png`} left={g.cLeft} top={g.cTop} winW={g.contentW} winH={g.contentH} imgH={isM ? COMPARE_FULL_H * g.scale : g.contentH} ty={isM ? round(-cmpScroll * g.scale) : 0} opacity={compareOp} />
        <Shot src={`screens/${dir}/pdp-full.png`} left={g.cLeft} top={g.cTop} winW={g.contentW} winH={g.contentH} imgH={pdpH * g.scale} ty={round(-scroll * g.scale)} opacity={pdpOp} />
        {/* identical to pdp-full but with the priciest dot's real store+price tooltip — fades in while the cursor hovers it */}
        <Shot src={`screens/${dir}/pdp-hover.png`} left={g.cLeft} top={g.cTop} winW={g.contentW} winH={g.contentH} imgH={pdpH * g.scale} ty={round(-scroll * g.scale)} opacity={pdpOp * pdpHoverOp} />

        {isM
          ? <TapDot x={cx} y={cy} press={press} green={t.green} />
          : <ArrowCursor x={cx} y={cy} press={press} green={t.green} />}
      </div>

      {isM && <div style={{ position: "absolute", left: width / 2 - 70, top: g.frameY + g.frameH - 28, width: 140, height: 7, borderRadius: 99, background: t.ink, opacity: 0.5 }} />}

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
