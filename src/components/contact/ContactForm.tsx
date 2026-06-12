"use client";

/* Client-side contact form with inline state.
   - Posts JSON to a Formspree-style endpoint when configured.
   - Falls back to opening the user's mail client with a prefilled body
     if no endpoint is set (dev / preview without secrets).
   - Honeypot field for trivial bot-spam mitigation (no captcha to keep
     the bar low for real humans). */

import { useState, type FormEvent } from "react";
import { Loader2, Check, AlertTriangle, Send } from "lucide-react";

interface Props {
  endpoint: string;
}

type Status = "idle" | "submitting" | "ok" | "error";

export default function ContactForm({ endpoint }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    // Honeypot — real users leave this blank; bots fill every field
    if ((data.get("website") as string)?.trim()) {
      // Pretend success so bots don't iterate
      setStatus("ok");
      form.reset();
      return;
    }

    // No endpoint configured → fall back to mailto so the user isn't stuck
    if (!endpoint) {
      const subject = encodeURIComponent("Havlo · Contact form");
      const body = encodeURIComponent(
        `From: ${data.get("name") ?? ""} <${data.get("email") ?? ""}>\n\n${data.get("message") ?? ""}`,
      );
      window.location.href = `mailto:hello@havlo.io?subject=${subject}&body=${body}`;
      setStatus("idle");
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name:    data.get("name"),
          email:   data.get("email"),
          message: data.get("message"),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }
      setStatus("ok");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Try again?");
    }
  }

  if (status === "ok") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-success/30 bg-success/10 p-6 flex items-start gap-3"
      >
        <Check className="text-success shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-ink font-semibold mb-1">Message sent.</p>
          <p className="text-ink-2 text-sm leading-relaxed">
            Thanks for reaching out. We read every message and reply within
            1 to 2 business days. Check your inbox (and spam, just in case).
          </p>
        </div>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Honeypot — visually hidden + screen-reader hidden + tabindex=-1
          so keyboard users skip it entirely. Bots that parse the DOM
          and fill every input still get caught. */}
      <div aria-hidden="true" className="hidden" tabIndex={-1}>
        <label aria-hidden="true">
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
        </label>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          maxLength={120}
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-shadow"
          placeholder="Full name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={200}
          inputMode="email"
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-shadow"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-ink mb-1.5">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={4000}
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60 transition-shadow resize-y min-h-[140px]"
          placeholder="What's on your mind?"
        />
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3"
        >
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-ink-2">
            {errorMsg || "Couldn't send your message. Try again, or email hello@havlo.io directly."}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-ink text-bg font-semibold text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send size={16} />
            Send message
          </>
        )}
      </button>
    </form>
  );
}
