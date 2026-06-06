import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { THEMES, type ThemeName } from "./brand";
import { MARKETS, type MarketKey } from "./data";
import type { Ctx } from "./scenes/_common";
import { SceneHook } from "./scenes/SceneHook";
import { SceneSearch } from "./scenes/SceneSearch";
import { SceneCompare } from "./scenes/SceneCompare";
import { SceneStores } from "./scenes/SceneStores";
import { SceneTrack } from "./scenes/SceneTrack";
import { SceneCashback } from "./scenes/SceneCashback";
import { SceneCTA } from "./scenes/SceneCTA";

/* Homepage / social explainer, parameterized by theme + market.

   Pacing (req 11) — generous per scene so nothing reads too fast:
     hook 200 · search 130 · compare 150 · stores 160 · track 160 ·
     cashback 140 · CTA 120  =  1060 frames of sequences
   minus 6 × 16-frame cross-fades = 964 frames ≈ 32s @ 30fps.
   Keep DURATION below in sync with Root.tsx. */
export const EXPLAINER_DURATION = 964;
const F = () => linearTiming({ durationInFrames: 16 });

export interface ExplainerProps {
  theme: ThemeName;
  market: MarketKey;
}

export const HavloExplainer: React.FC<ExplainerProps> = ({ theme, market }) => {
  const ctx: Ctx = { theme: THEMES[theme], market: MARKETS[market] };
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={200}><SceneHook ctx={ctx} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={F()} />
      <TransitionSeries.Sequence durationInFrames={130}><SceneSearch ctx={ctx} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={F()} />
      <TransitionSeries.Sequence durationInFrames={150}><SceneCompare ctx={ctx} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={F()} />
      <TransitionSeries.Sequence durationInFrames={160}><SceneStores ctx={ctx} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={F()} />
      <TransitionSeries.Sequence durationInFrames={160}><SceneTrack ctx={ctx} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={F()} />
      <TransitionSeries.Sequence durationInFrames={140}><SceneCashback ctx={ctx} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={F()} />
      <TransitionSeries.Sequence durationInFrames={120}><SceneCTA ctx={ctx} /></TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
