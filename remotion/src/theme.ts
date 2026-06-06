/* Havlo brand tokens, mirrored from the app (src/app/globals.css +
   tailwind.config.ts) so the videos match the product exactly. */
export const BRAND = {
  blue:     "#0057FF", // --brand DEFAULT (selection / shadow colour in app)
  blueDeep: "#0042C4",
  bg:       "#0A0C10", // dark-mode --bg-rgb (10 12 16)
  surface:  "#161B23",
  surface2: "#1F2630",
  ink:      "#F6F8FB", // dark-mode --ink-rgb (246 248 251)
  inkSub:   "#B2B8C4", // dark-mode --ink-2
  inkFaint: "#7A8290", // dark-mode --ink-3
  green:    "#34D87A", // success, brightened for video pop
  amber:    "#F5A524",
  border:   "rgba(255,255,255,0.09)",
} as const;

/* Inter is the app's body face (--font-inter). System fallback keeps the
   render self-contained; load the real Inter/Bricolage webfonts via
   @remotion/google-fonts when we lock the final cut. */
export const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
