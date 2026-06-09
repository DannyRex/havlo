"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* Cashback + paste-a-link in one compact, intentional panel (the page hero
   above already carries the "Amazon deals / don't overpay" framing, so this
   stays terse and just owns the cashback CTA).

   The single action: paste an Amazon product link and we route to that
   product on Amazon through our Associates tag (via /api/amazon-search, which
   host-validates and 302s) so the purchase qualifies for cashback. No keyword
   search, no Havlo compare detour. Cashback is Phase 1 (waitlist) -> framed
   "coming soon". */
export default function AmazonSearchBar({
  countryCode,
  cashbackPercent,
}: {
  countryCode: string;
  cashbackPercent: number;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function isAmazonLink(v: string): boolean {
    const t = v.trim().toLowerCase();
    return (
      /(^|\/\/|\.)amazon\.[a-z.]{2,}(\/|$)/.test(t) ||
      t.includes("amzn.to/") ||
      t.includes("a.co/")
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!isAmazonLink(v)) {
      setError(true);
      return;
    }
    setError(false);
    window.open(
      `/api/amazon-search?url=${encodeURIComponent(v)}&country=${encodeURIComponent(countryCode)}`,
      "_blank",
      "noopener",
    );
  }

  return (
    <section className="mb-8 rounded-2xl bg-surface-2 shadow-card-lg p-4 sm:p-6">
      {/* Headline + coming-soon tag */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] sm:text-lg font-bold text-ink tracking-[-0.01em]">
          Earn {cashbackPercent}% back on Amazon
        </h2>
        <span className="shrink-0 rounded-full bg-success/15 text-success text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1">
          Coming soon
        </span>
      </div>

      {/* Input with inline submit — the focal point */}
      <form onSubmit={onSubmit} className="relative mt-3.5">
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(false);
          }}
          maxLength={2048}
          enterKeyHint="go"
          autoComplete="off"
          placeholder="Paste an Amazon product link"
          aria-label="Paste an Amazon product link"
          aria-invalid={error}
          className="w-full rounded-full border border-border bg-bg pl-5 pr-14 py-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-success transition-colors"
        />
        <button
          type="submit"
          aria-label="Shop this Amazon link through Havlo"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-ink text-bg hover:opacity-90 active:scale-95 transition-all"
        >
          <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </form>

      {/* One terse helper line + waitlist */}
      <p className="mt-2.5 text-[12.5px] text-ink-3 leading-relaxed">
        {error ? (
          <span className="text-error">
            That doesn&apos;t look like an Amazon link. Paste a full product URL.
          </span>
        ) : (
          <>Shop any Amazon product through Havlo. </>
        )}
        {/* block on mobile so 'Join the waitlist' drops to its own line
            under the helper sentence; inline from sm up. */}
        <Link
          href={`/${countryCode}/cashback`}
          className="block sm:inline font-semibold text-success hover:underline underline-offset-2"
        >
          Join the waitlist
        </Link>
      </p>
    </section>
  );
}
