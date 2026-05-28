"use client";

/* "Set price alert" — tertiary CTA below the compare button on the
   PDP. Opens an inline popover with email + target price inputs,
   POSTs to /api/alerts.

   Design notes:
     • Tertiary visual weight — bell icon + text link styling, not a
       full button. Doesn't compete with "Visit {Store}" (primary)
       or "Compare prices across stores" (secondary).
     • Inline popover, not full-screen modal — the form is two
       fields, no need to dim the page.
     • Currency-aware target input: shows the user's currency
       symbol prefix (₦ / $ / £ / etc) read from the country prop.
       Target gets converted to NGN client-side before POST since the
       DB stores NGN as the canonical price-comparison currency.
     • Success state replaces the form inline ("We'll email
       you when it hits {target}") rather than a toast — keeps the
       feedback visible long enough for users to read it.

   Error handling: every non-200 from /api/alerts renders an inline
   error below the form (form stays open so user can edit + retry).
   Invalid client-side state (no email, missing target) doesn't even
   fire the request.

   Privacy: no consent gate — the email is collected for transactional
   email only and the privacy policy already discloses this use. Same
   posture as /api/notify-product. */

import { useRef, useState } from "react";
import { Bell, BellRing, Check, X } from "lucide-react";
import type { Country } from "@/lib/country";
import { USD_FX } from "@/lib/country";

interface Props {
  productId:        string;
  productTitle:     string;
  currentPriceNgn:  number;
  country:          Country;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PriceAlertButton({ productId, productTitle, currentPriceNgn, country }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const targetInputRef = useRef<HTMLInputElement>(null);
  /* Pre-fill target with a 10% discount on current price — most
     shoppers want a meaningful discount, not a 1% improvement.
     Rounded for readability. */
  const defaultTargetNgn = Math.round(currentPriceNgn * 0.9 / 100) * 100;
  const defaultTargetDisplay = Math.round(ngnToDisplay(defaultTargetNgn, country));
  /* Store formatted display string. Raw value for submission is
     parsed back on handleSubmit. Pre-format the default so the
     initial render is consistent with the typing experience. */
  const [target, setTarget] = useState(formatTargetInput(String(defaultTargetDisplay)));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isProductIdValid = UUID_RE.test(productId);

  async function handleSubmit() {
    setErrorMsg(null);
    if (!email || !EMAIL_RE.test(email)) {
      setErrorMsg("Enter a valid email.");
      return;
    }
    const targetNumber = Number(target.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(targetNumber) || targetNumber <= 0) {
      setErrorMsg("Enter a valid target price.");
      return;
    }
    /* Convert the user's display-currency input back to NGN before
       POSTing. The DB stores NGN canonically. */
    const targetNgn = displayToNgn(targetNumber, country);
    if (targetNgn >= currentPriceNgn) {
      setErrorMsg("Pick a target below the current price.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/alerts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          /* Pass productId ONLY when it's a real UUID. Synthetic /
             curated ids get nulled and the server falls back to query
             matching on the title. */
          productId: isProductIdValid ? productId : undefined,
          query:     isProductIdValid ? undefined : productTitle,
          productTitle,
          targetPriceNgn: targetNgn,
          country: country.code,
          source: "pdp",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Could not save alert. Try again?");
        return;
      }
      setDone(true);
    } catch {
      setErrorMsg("Network error. Try again?");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      /* Full-width confirmation card so it matches the visual rhythm
         of the surrounding PriceComparisonBar / per-store rails. */
      <div className="flex items-start gap-2 w-full mt-2 px-4 py-2.5 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
        <Check size={16} className="mt-0.5 shrink-0" />
        <span>
          You&apos;re set. We&apos;ll email you when {productTitle.slice(0, 40)}{productTitle.length > 40 ? "…" : ""} drops to your target.
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors underline-offset-4 hover:underline"
      >
        <Bell size={14} />
        Set a price alert
      </button>
    );
  }

  return (
    /* Full-width expanded panel so the form spans the same column as
       the PriceComparisonBar below + the "Visit" / "Compare" CTAs
       above. Previously capped at max-w-sm which stranded the form
       at a child width on desktop and looked inconsistent next to
       the bar. */
    <div className="w-full mt-2 p-4 rounded-xl border border-border bg-surface-2/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BellRing size={16} className="text-ink" />
          <h4 className="text-sm font-semibold text-ink">Set a price alert</h4>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-3 hover:text-ink"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-ink-3 mb-3">
        We&apos;ll email you when the price drops below your target at any store you can buy from.
      </p>

      <label className="block text-xs font-medium text-ink-2 mb-1">Your email</label>
      <input
        type="email"
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 mb-3 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        autoComplete="email"
      />

      <label className="block text-xs font-medium text-ink-2 mb-1">
        Notify me when price drops to
      </label>
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3 pointer-events-none">
          {country.symbol}
        </span>
        <input
          ref={targetInputRef}
          type="text"
          inputMode="decimal"
          value={target}
          onChange={(e) => {
            /* Format-while-typing with thousands separators.
               Counts the number of digit/decimal characters BEFORE
               the cursor in the user's raw input, then restores the
               cursor to the same significant-char position in the
               formatted string. Without this, the cursor jumps to
               the end on every keystroke after a comma reflow. */
            const input = e.currentTarget;
            const raw = input.value;
            const cursorPre = input.selectionStart ?? raw.length;
            const sigCharsBefore = raw.slice(0, cursorPre).replace(/[^0-9.]/g, "").length;

            const formatted = formatTargetInput(raw);
            setTarget(formatted);

            /* Restore cursor after React commits. requestAnimationFrame
               lands AFTER the controlled-input value update so
               setSelectionRange operates on the right string. */
            requestAnimationFrame(() => {
              const el = targetInputRef.current;
              if (!el) return;
              let seen = 0;
              let pos = 0;
              for (let i = 0; i < formatted.length; i++) {
                if (seen >= sigCharsBefore) break;
                if (/[0-9.]/.test(formatted[i])) seen++;
                pos = i + 1;
              }
              el.setSelectionRange(pos, pos);
            });
          }}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-ink/20"
          aria-label={`Target price in ${country.currency}`}
        />
      </div>

      {errorMsg && (
        <p className="text-xs text-error mb-2">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full px-4 py-2.5 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Setting alert…" : "Set alert"}
      </button>
    </div>
  );
}

/* ── Currency math ─────────────────────────────────────────────────
   The DB stores NGN as the canonical price-comparison currency.
   USD-source offers get converted on read; targets get converted on
   write. We use the same USD_FX rates the rest of the app reads so
   conversions stay consistent across surfaces. */

function ngnToDisplay(ngn: number, country: Country): number {
  /* country.currency is the user's display currency code. NG → NGN,
     no conversion. Others → divide by their USD_FX rate, since the
     rates are expressed as "1 USD = X local". To convert NGN → USD
     we'd do ngn / USD_FX.NGN; to convert NGN → other-local we then
     multiply by USD_FX.OTHER. */
  if (country.currency === "NGN") return ngn;
  const usd = ngn / USD_FX.NGN;
  const rate = USD_FX[country.currency as keyof typeof USD_FX] ?? 1;
  return usd * rate;
}

function displayToNgn(displayAmount: number, country: Country): number {
  if (country.currency === "NGN") return displayAmount;
  const rate = USD_FX[country.currency as keyof typeof USD_FX] ?? 1;
  const usd = displayAmount / rate;
  return usd * USD_FX.NGN;
}

/* Format a raw target-price input string into a display string with
   thousand separators. Strips disallowed characters, normalises to
   a single decimal point, and caps fractional digits at 2.

   Examples:
     "12500"      → "12,500"
     "12,500.5"   → "12,500.5"
     "12.50.30"   → "12.50"      (extra dots collapsed)
     "abc1,234x5" → "12,345"     (non-digits stripped)
     ""           → ""
     "."          → "."          (allow lone decimal during typing)
     ".5"         → ".5"
   The submit path runs Number(target.replace(/[^0-9.]/g, "")) which
   parses any well-formed display value back to a number cleanly. */
function formatTargetInput(raw: string): string {
  /* Step 1: strip everything except digits + decimal points. */
  let cleaned = raw.replace(/[^0-9.]/g, "");

  /* Step 2: collapse multiple decimal points to the first one. */
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }

  /* Step 3: cap fractional digits at 2 (matches the precision the
     DB stores prices at — numeric(12,2)). */
  if (firstDot !== -1 && cleaned.length > firstDot + 3) {
    cleaned = cleaned.slice(0, firstDot + 3);
  }

  /* Step 4: split, format integer part with thousand separators,
     reattach decimal. Empty string stays empty so a cleared field
     doesn't render as "0". */
  if (cleaned === "") return "";
  const [intPart, decPart] = cleaned.split(".");
  /* Normalise leading zeros on the integer part — "007500" → "7500".
     Empty intPart (e.g. user typed ".5") stays empty so leading dot
     is preserved. */
  const intNormalised = intPart === "" ? "" : String(parseInt(intPart, 10));
  const intGrouped = intNormalised.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${intGrouped}.${decPart}` : intGrouped;
}
