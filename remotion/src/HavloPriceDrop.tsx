import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { THEMES, type ThemeName } from "./brand";
import { MARKETS } from "./data";
import type { Ctx } from "./scenes/_common";
import { SceneHook } from "./scenes/SceneHook";
import { SceneCTA } from "./scenes/SceneCTA";

/* Standalone ~9s hook (good for social / a looping hero on its own).
   Refreshed to the new brand (req 10): green, silver-metal logo, real
   copy, iPhone 17 Pro Max, "Shop smarter." close. Reuses the same
   brand-correct scenes as the full explainer, so it never drifts. */
export const PRICEDROP_DURATION = 276; // 195 + 95 - 14 transition

export const HavloPriceDrop: React.FC<{ theme: ThemeName }> = ({ theme }) => {
  const ctx: Ctx = { theme: THEMES[theme], market: MARKETS.agnostic };
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={195}>
        <SceneHook ctx={ctx} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 14 })} />
      <TransitionSeries.Sequence durationInFrames={95}>
        <SceneCTA ctx={ctx} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
