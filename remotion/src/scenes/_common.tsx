import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { Theme } from "../brand";
import type { Market } from "../data";
import { SANS } from "../fonts";

/* Context every scene receives from the master composition. */
export interface Ctx {
  theme: Theme;
  market: Market;
}

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* spring-entrance helper bound to current frame + fps. */
export const useEnter = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (start: number, stiffness = 110) =>
    spring({ frame: frame - start, fps, config: { damping: 18, mass: 0.7, stiffness } });
};

/* Theme-aware scene canvas — flat brand bg (no gradients, founder
   direction). */
export const SceneShell: React.FC<{ theme: Theme; children: React.ReactNode }> = ({ theme, children }) => (
  <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: SANS }}>
    {children}
  </AbsoluteFill>
);

/* Green uppercase eyebrow. */
export const Eyebrow: React.FC<{ theme: Theme; children: React.ReactNode; opacity?: number }> = ({
  theme,
  children,
  opacity = 1,
}) => (
  <div
    style={{
      opacity,
      color: theme.green,
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);
