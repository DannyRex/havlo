import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

/* Daily FX refresh. Populates the fx_rates table (migration 0072) that the
   SQL RPCs read via fx_rate() and that TS reads via
   src/lib/fx-rates.generated.ts, replacing the old hardcoded USD->NGN rate.

   Sources (keyless, free, daily, both carry NGN):
     primary  = open.er-api.com
     fallback = fawazahmed0 currency-api (jsdelivr CDN)
   ECB-based feeds (Frankfurter) are unusable here because they omit NGN, the
   canonical currency. If the primary source hiccups we transparently fall
   back to the secondary so a single-source outage can't freeze the rates.

   NGN policy (Jun 2026): NGN now tracks the LIVE market rate daily, exactly
   like every other currency -- it is no longer pinned to a hand-set value
   that someone has to remember to review. Post-float the naira's official /
   interbank rate and the parallel/street rate have largely converged, and the
   old static 1650 seed had drifted ~20% ABOVE the live market (it was set
   during the early-2024 naira weakness and never updated, so the NG catalogue
   was silently over-priced). The entire point of this change is that nobody
   has to touch the rate by hand again. NGN_PARALLEL_PREMIUM stays as an
   OPTIONAL multiplier (default 1.0 = pure live market, the chosen policy) in
   case a parallel-rate cushion is ever wanted; it is not required.

   Every rate is sanity-bounded: a value outside a wide per-currency band is
   treated as a glitched payload (decimal shift, zero, wrong base) and that
   currency is skipped for the run -- its last good DB row is left intact
   rather than re-pricing the whole catalogue off a bad number. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {}

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const QUOTES = ["NGN", "GBP", "EUR", "AED", "INR", "ZAR"];

/* Wide per-currency plausibility bands (1 USD = X). Tight enough to catch a
   glitched feed (decimal shift / 0 / wrong-base response), loose enough never
   to reject a genuine market move. */
const SANITY: Record<string, [number, number]> = {
  NGN: [600, 4000],
  GBP: [0.4, 1.5],
  EUR: [0.4, 1.5],
  AED: [2.5, 5.0],
  INR: [40, 160],
  ZAR: [8, 35],
};

/* Optional parallel-rate cushion for NGN. Default 1.0 = track the pure live
   market rate (the chosen policy). Set NGN_PARALLEL_PREMIUM to e.g. "1.08" to
   layer an 8% street-rate spread on top, with zero code changes. */
const ngnPremium = (() => {
  const raw = process.env.NGN_PARALLEL_PREMIUM;
  const n = raw ? Number(raw) : 1.0;
  return isFinite(n) && n > 0 ? n : 1.0;
})();

type RateMap = Record<string, number>;

/* Primary: open.er-api.com -> { result, rates: { NGN: 1360.4, GBP: 0.74 } }. */
async function fetchPrimary(): Promise<RateMap | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) { console.warn("primary FX http", res.status); return null; }
    const data: any = await res.json();
    if (data?.result !== "success" || !data?.rates) {
      console.warn("primary FX bad payload:", data?.result ?? "(no result)");
      return null;
    }
    return data.rates as RateMap;
  } catch (e: any) {
    console.warn("primary FX error:", e?.message ?? e);
    return null;
  }
}

/* Fallback: fawazahmed0 currency-api via jsdelivr ->
   { date, usd: { ngn: 1360.1, gbp: 0.74 } } with lowercase keys. */
async function fetchFallback(): Promise<RateMap | null> {
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    );
    if (!res.ok) { console.warn("fallback FX http", res.status); return null; }
    const data: any = await res.json();
    const usd = data?.usd;
    if (!usd || typeof usd !== "object") {
      console.warn("fallback FX bad payload");
      return null;
    }
    const out: RateMap = {};
    for (const q of QUOTES) {
      const v = Number(usd[q.toLowerCase()]);
      if (isFinite(v) && v > 0) out[q] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch (e: any) {
    console.warn("fallback FX error:", e?.message ?? e);
    return null;
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supa = createClient(SUPABASE_URL, SUPABASE_KEY);

  let rates = await fetchPrimary();
  let sourceName = "open.er-api.com";
  if (!rates) {
    console.warn("primary FX source unavailable -> trying fallback");
    rates = await fetchFallback();
    sourceName = "fawazahmed0/currency-api";
  }
  if (!rates) {
    console.error("Both FX sources failed -- leaving fx_rates untouched.");
    process.exit(1);
  }

  const nowIso = new Date().toISOString();
  const rows: {
    base: string;
    quote: string;
    rate: number;
    source: string;
    updated_at: string;
  }[] = [];

  for (const q of QUOTES) {
    let v = Number(rates[q]);
    if (!v || !isFinite(v) || v <= 0) {
      console.warn(`skip ${q}: no usable rate from ${sourceName}`);
      continue;
    }
    let source = sourceName;
    /* NGN tracks the live market by default (premium 1.0). Only label/scale
       when an explicit parallel cushion is configured. */
    if (q === "NGN" && ngnPremium !== 1.0) {
      v = v * ngnPremium;
      source = `${sourceName} x${ngnPremium}`;
    }
    const band = SANITY[q];
    if (band && (v < band[0] || v > band[1])) {
      console.warn(
        `skip ${q}: ${v} outside sanity band [${band[0]}, ${band[1]}] ` +
          `-- treating as a bad feed, keeping the last good row`,
      );
      continue;
    }
    rows.push({
      base: "USD",
      quote: q,
      /* NGN to 2dp (whole-naira display anyway); others to 6dp. */
      rate: q === "NGN" ? Math.round(v * 100) / 100 : Math.round(v * 1e6) / 1e6,
      source,
      updated_at: nowIso,
    });
  }

  if (!rows.length) {
    console.log("Nothing to upsert.");
    return;
  }

  const { error } = await supa
    .from("fx_rates")
    .upsert(rows, { onConflict: "base,quote" });
  if (error) {
    // Tolerate the table not existing yet (migration 0072 not applied) so a
    // pre-migration scheduled run doesn't show up as a red workflow. Any
    // other error is a real failure and exits non-zero.
    const missingTable =
      /fx_rates/i.test(error.message) &&
      /(does not exist|schema cache|find the table)/i.test(error.message);
    if (missingTable) {
      console.log(
        "fx_rates table not found yet -- apply migration 0072 in Supabase, " +
          "then this cron will populate it. Skipping this run.",
      );
      return;
    }
    console.error("upsert failed:", error.message);
    process.exit(1);
  }
  console.log(
    `fx_rates updated (${nowIso}, ${sourceName}): ` +
      rows.map((r) => `${r.quote}=${r.rate}`).join(", "),
  );

  // Mirror the table into the build-time generated file so country.ts's
  // client-safe USD_FX reads the live DISPLAY rates without a DB import.
  // The workflow commits this file when it changes. NGN now follows the live
  // market like the rest, so this updates whenever the naira moves.
  const { data: allRows } = await supa
    .from("fx_rates")
    .select("quote, rate")
    .eq("base", "USD");
  if (allRows && allRows.length) {
    const ORDER = ["NGN", "GBP", "EUR", "AED", "INR", "ZAR"];
    const map: Record<string, number> = { USD: 1 };
    for (const q of ORDER) {
      const row = allRows.find((r: any) => r.quote === q);
      const rate = row ? Number(row.rate) : NaN;
      if (rate > 0 && isFinite(rate)) map[q] = Math.round(rate * 1e4) / 1e4;
    }
    const body =
      `/* AUTO-GENERATED by scripts/fetch-fx-rates.ts from the fx_rates table.\n` +
      `   Do NOT edit by hand. Build-time mirror of the live FX rates so\n` +
      `   country.ts USD_FX stays a static, client-safe, hydration-stable\n` +
      `   constant. The daily FX cron rewrites + commits this. "1 USD = X". */\n` +
      `export const FX_GENERATED: Record<string, number> = ${JSON.stringify(map, null, 2)};\n`;
    writeFileSync("src/lib/fx-rates.generated.ts", body);
    console.log("wrote src/lib/fx-rates.generated.ts:", JSON.stringify(map));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
