/* Brand typefaces, mirroring the app:
     • Inter            — body/UI (--font-inter)
     • Bricolage Grotesque — display headlines (--font-display)
     • Slackey          — the logo wordmark face (--font-logo)

   Inter + Bricolage come from @remotion/google-fonts. Slackey isn't in
   that package, so we self-host the woff2 (remotion/public, downloaded
   from Google Fonts, OFL) and register it via FontFace, gating the
   render with delayRender so every frame has the wordmark. */
import { staticFile, delayRender, continueRender } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";

export const SANS = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
}).fontFamily;

export const DISPLAY = loadBricolage("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
}).fontFamily;

export const LOGO_FONT = "SlackeyHavlo";

const handle = delayRender("load-slackey");
const slackey = new FontFace(
  LOGO_FONT,
  `url(${staticFile("Slackey-Regular.woff2")}) format("woff2")`,
);
slackey
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch(() => continueRender(handle));
