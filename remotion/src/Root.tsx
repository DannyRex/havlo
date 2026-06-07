import { Composition } from "remotion";
import { HavloPriceDrop, PRICEDROP_DURATION } from "./HavloPriceDrop";
import { HavloExplainer, EXPLAINER_DURATION } from "./HavloExplainer";
import { BrandProof } from "./BrandProof";
import { CursorFlow, CURSORFLOW_DURATION, type Device } from "./CursorFlow";
import type { ThemeName } from "./brand";
import type { MarketKey } from "./data";

/* Cursor demo variant matrix: device × theme. Desktop is 1920×1080
   landscape (browser chrome); mobile is 1080×1920 portrait (phone
   chrome). Walks search → PDP (spectrum + history) → compare. */
const FLOW_VARIANTS: { device: Device; theme: ThemeName; w: number; h: number }[] = [
  { device: "desktop", theme: "light", w: 1920, h: 1080 },
  { device: "desktop", theme: "dark", w: 1920, h: 1080 },
  { device: "mobile", theme: "light", w: 1080, h: 1920 },
  { device: "mobile", theme: "dark", w: 1080, h: 1920 },
];

/* Explainer variant matrix: market × theme. Render any via Studio or
   `npx remotion render Explainer-<market>-<theme> out/<name>.mp4`.
   Country videos (ng/uk/us) use real local stores + currency; agnostic
   is currency-neutral. */
const VARIANTS: { market: MarketKey; theme: ThemeName }[] = [
  { market: "agnostic", theme: "dark" },
  { market: "agnostic", theme: "light" },
  { market: "ng", theme: "dark" },
  { market: "ng", theme: "light" },
  { market: "uk", theme: "dark" },
  { market: "uk", theme: "light" },
  { market: "us", theme: "dark" },
  { market: "us", theme: "light" },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {VARIANTS.map((v) => (
        <Composition
          key={`${v.market}-${v.theme}`}
          id={`Explainer-${v.market}-${v.theme}`}
          component={HavloExplainer}
          defaultProps={{ theme: v.theme, market: v.market }}
          durationInFrames={EXPLAINER_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
      ))}

      {/* Brand cards / CTA proof, one per theme. */}
      <Composition id="BrandProof-Dark" component={BrandProof} defaultProps={{ theme: "dark" as const }} durationInFrames={120} fps={30} width={1920} height={1080} />
      <Composition id="BrandProof-Light" component={BrandProof} defaultProps={{ theme: "light" as const }} durationInFrames={120} fps={30} width={1920} height={1080} />

      {/* Cursor demo over REAL havlo.io screenshots, one per device×theme:
          search → PDP (price spectrum + history) → "Compare across N
          stores" → live 4-store compare → "Shop smarter." end card. */}
      {FLOW_VARIANTS.map((v) => (
        <Composition
          key={`flow-${v.device}-${v.theme}`}
          id={`CursorFlow-${v.device === "desktop" ? "Desktop" : "Mobile"}-${v.theme === "dark" ? "Dark" : "Light"}`}
          component={CursorFlow}
          defaultProps={{ device: v.device, theme: v.theme }}
          durationInFrames={CURSORFLOW_DURATION}
          fps={30}
          width={v.w}
          height={v.h}
        />
      ))}

      {/* Standalone ~9s hook, one per theme (brand-refreshed). */}
      <Composition id="HavloPriceDrop-Dark" component={HavloPriceDrop} defaultProps={{ theme: "dark" as const }} durationInFrames={PRICEDROP_DURATION} fps={30} width={1920} height={1080} />
      <Composition id="HavloPriceDrop-Light" component={HavloPriceDrop} defaultProps={{ theme: "light" as const }} durationInFrames={PRICEDROP_DURATION} fps={30} width={1920} height={1080} />
    </>
  );
};
