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

import { useState } from "react";
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
  /* Pre-fill target with a 10% discount on current price — most
     shoppers want a meaningful discount, not a 1% improvement.
     Rounded for readability. */
  const defaultTargetNgn = Math.round(currentPriceNgn * 0.9 / 100) * 100;
  const defaultTargetDisplay = Math.round(ngnToDisplay(defaultTargetNgn, country));
  const [target, setTarget] = useState(String(defaultTargetDisplay));
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
      <div className="inline-flex items-start gap-2 mt-2 px-4 py-2.5 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
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
    <div className="mt-2 p-4 rounded-xl border border-border bg-surface-2/60 max-w-sm">
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
          type="text"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
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
