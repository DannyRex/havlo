/* Skimlinks affiliate auto-monetization — gated on NEXT_PUBLIC_SKIMLINKS_ID
   so it stays completely invisible until the env var is populated. No-op
   render means no script tag, no network calls, zero perf cost pre-launch.

   How Skimlinks works:
     The script walks the DOM after load, finds links to any of their
     ~48,500 supported retailers, and silently rewrites them with our
     affiliate parameters. Zero per-merchant work — every "go" link to a
     supported retailer becomes monetized automatically.

   Why lazyOnload (not afterInteractive):
     Skimlinks is non-critical revenue plumbing — link rewriting can wait
     until the browser is idle. lazyOnload schedules via
     requestIdleCallback so it never competes with first-paint or
     interactivity work.

   Why env-driven:
     Keeps the publisher ID out of the repo (it's not a secret per se,
     but treating it like config means dev/preview environments don't
     accidentally fire affiliate scripts and skew Skimlinks dashboard
     stats).

   Setup:
     Set NEXT_PUBLIC_SKIMLINKS_ID=302355X1790351 in Vercel envs (the
     numeric publisher ID Skimlinks shows you in the install snippet,
     between "/js/" and ".skimlinks.js"). No further code change needed.
*/

import Script from "next/script";

export default function Skimlinks() {
  const id = process.env.NEXT_PUBLIC_SKIMLINKS_ID;
  if (!id) return null;

  return (
    <Script
      id="skimlinks"
      src={`https://s.skimresources.com/js/${id}.skimlinks.js`}
      strategy="lazyOnload"
    />
  );
}
