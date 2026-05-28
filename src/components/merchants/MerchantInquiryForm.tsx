"use client";

/* Merchant inquiry form for /for-merchants.

   Persists to merchant_inquiries (migration 0057) AND fires an email
   to hello@havlo.io so the team gets notified without
   polling the dashboard. Confirmation email to the submitter on
   success.

   Same failure-tolerance posture as /api/notify-product: when the
   table isn't migrated yet, the API returns ok:true and we render
   the success state — partner experience preserved during rollout. */

import { useState } from "react";
import { Check, AlertCircle } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE   = /^https?:\/\/.+/i;

interface FormState {
  storeName:   string;
  contactName: string;
  email:       string;
  storeUrl:    string;
  feedUrl:     string;
  countries:   string;
  skuCount:    string;
  notes:       string;
}

const INITIAL: FormState = {
  storeName:   "",
  contactName: "",
  email:       "",
  storeUrl:    "",
  feedUrl:     "",
  countries:   "",
  skuCount:    "",
  notes:       "",
};

export default function MerchantInquiryForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.storeName.trim() || form.storeName.length < 2) {
      setErrorMsg("Store name is required.");
      return;
    }
    if (!form.email.trim() || !EMAIL_RE.test(form.email)) {
      setErrorMsg("Enter a valid email.");
      return;
    }
    if (!form.storeUrl.trim() || !URL_RE.test(form.storeUrl)) {
      setErrorMsg("Store URL must start with http:// or https://");
      return;
    }
    if (form.feedUrl.trim() && !URL_RE.test(form.feedUrl)) {
      setErrorMsg("Feed URL must start with http:// or https://");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/merchant-inquiry", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Could not submit. Try again?");
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
      <div className="rounded-xl border border-success/20 bg-success/5 p-6">
        <div className="flex items-start gap-3 mb-2">
          <Check size={20} className="text-success mt-0.5 shrink-0" />
          <h3 className="text-base font-semibold text-ink">Got it. We&apos;ll be in touch.</h3>
        </div>
        <p className="text-sm text-ink-2 leading-relaxed">
          We respond to merchant inquiries within two business days. Look out
          for an email from <strong>hello@havlo.io</strong>. Sometimes it
          lands in Promotions, so check there too.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Store name" required>
          <input
            type="text"
            value={form.storeName}
            onChange={(e) => update("storeName", e.target.value)}
            className={inputClass}
            placeholder="e.g. Acme Electronics"
          />
        </Field>
        <Field label="Your name">
          <input
            type="text"
            value={form.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            className={inputClass}
            placeholder="Who should we reply to?"
          />
        </Field>
      </div>

      <Field label="Email" required>
        <input
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className={inputClass}
          placeholder="you@store.com"
          autoComplete="email"
        />
      </Field>

      <Field label="Store URL" required>
        <input
          type="url"
          value={form.storeUrl}
          onChange={(e) => update("storeUrl", e.target.value)}
          className={inputClass}
          placeholder="https://www.acme.com"
        />
      </Field>

      <Field label="Product feed URL" hint="Google Shopping XML, CSV, or Shopify /products.json. Optional. We can help set this up.">
        <input
          type="url"
          value={form.feedUrl}
          onChange={(e) => update("feedUrl", e.target.value)}
          className={inputClass}
          placeholder="https://www.acme.com/feed.xml"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Countries you ship to" hint="e.g. NG, UK, US">
          <input
            type="text"
            value={form.countries}
            onChange={(e) => update("countries", e.target.value)}
            className={inputClass}
            placeholder="NG, UK"
          />
        </Field>
        <Field label="Approx SKU count">
          <input
            type="text"
            inputMode="numeric"
            value={form.skuCount}
            onChange={(e) => update("skuCount", e.target.value)}
            className={inputClass}
            placeholder="1,000"
          />
        </Field>
      </div>

      <Field label="Anything else?">
        <textarea
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Categories you focus on, integration questions, anything we should know."
        />
      </Field>

      {errorMsg && (
        <div className="flex items-start gap-2 text-sm text-error">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, required, hint, children }: FieldProps) {
  return (
    <label className="block">
      <div className="flex items-baseline gap-1.5 mb-1.5">
        <span className="text-xs font-semibold text-ink-2">{label}</span>
        {required && <span className="text-xs text-error">*</span>}
      </div>
      {children}
      {hint && <p className="text-[11px] text-ink-3 mt-1 leading-snug">{hint}</p>}
    </label>
  );
}

const inputClass = "w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink/20";
