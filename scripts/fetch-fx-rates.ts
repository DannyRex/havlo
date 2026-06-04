import { createClient } from "@supabase/supabase-js";

/* Daily FX refresh. Populates the fx_rates table (migration 0072) that the
   SQL RPCs read via fx_rate() and TS reads via src/lib/fx.ts, replacing the
   hardcoded USD->NGN rate.

   Source: open.er-api.com -- keyless, free, daily, and crucially carries
   NGN (the ECB-based feeds like Frankfurter do not, which is fatal since
   NGN is the canonical currency). Run by .github/workflows/fx-rates.yml.

   NGN policy: the naira's OFFICIAL rate (what this API reports) diverges
   from the PARALLEL/street rate Nigerians actually transact at for USD
   goods -- which is most likely why someone hardcoded 1650. To avoid
   silently re-pricing the entire NG catalogue at the official rate, NGN is
   only updated when NGN_PARALLEL_PREMIUM is set (effective = official x
   premium); otherwise the seeded/manually-set NGN row is left untouched.
   The other five currencies have a negligible official/parallel gap, so
   they always refresh live. */

try { (process as any).loadEnvFile?.(".env.local"); } catch {}

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const QUOTES = ["NGN", "GBP", "EUR", "AED", "INR", "ZAR"];

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supa = createClient(SUPABASE_URL, SUPABASE_KEY);

  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) {
    console.error("FX fetch failed:", res.status);
    process.exit(1);
  }
  const data: any = await res.json();
  if (data?.result !== "success" || !data?.rates) {
    console.error("FX bad payload:", data?.result ?? "(no result)");
    process.exit(1);
  }

  const premiumRaw = process.env.NGN_PARALLEL_PREMIUM;
  const ngnPremium = premiumRaw ? Number(premiumRaw) : null;

  const nowIso = new Date().toISOString();
  const rows: {
    base: string;
    quote: string;
    rate: number;
    source: string;
    updated_at: string;
  }[] = [];

  for (const q of QUOTES) {
    const official = Number(data.rates[q]);
    if (!official || !isFinite(official) || official <= 0) {
      console.warn(`skip ${q}: no usable rate from API`);
      continue;
    }
    if (q === "NGN") {
      if (ngnPremium && isFinite(ngnPremium) && ngnPremium > 0) {
        rows.push({
          base: "USD",
          quote: "NGN",
          rate: Math.round(official * ngnPremium * 100) / 100,
          source: `open.er-api.com x${ngnPremium}`,
          updated_at: nowIso,
        });
      } else {
        console.log(
          `NGN left untouched (set NGN_PARALLEL_PREMIUM to manage it; ` +
            `official today = ${official})`,
        );
      }
      continue;
    }
    rows.push({
      base: "USD",
      quote: q,
      rate: Math.round(official * 1e6) / 1e6,
      source: "open.er-api.com",
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
    `fx_rates updated (${nowIso}): ` +
      rows.map((r) => `${r.quote}=${r.rate}`).join(", "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
