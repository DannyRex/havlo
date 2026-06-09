"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgePercent, ArrowRight } from "lucide-react";

/* Cashback + paste-a-link, in one block (merged from the old standalone
   cashback banner to kill the repetition). Cashback is Phase 1 (waitlist),
   so the framing is "coming soon".

   The single action: paste an Amazon product link and we route you to that
   product on Amazon through our Associates tag (via /api/amazon-search,
   which validates the host and 302s) so the purchase qualifies for cashback.
   No keyword search, no Havlo compare detour. */
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
    <section className="mb-8 rounded-2xl border border-success/30 bg-success/5 p-5 sm:p-6">
      <div className="flex items-start gap-4 sm:gap-5">
        <span className="shrink-0 grid place-items-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-success/15 text-success">
          <BadgePercent size={26} strokeWidth={2} aria-hidden="true" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-success mb-1">
            Cashback &middot; coming soon
          </p>
          <h2 className="text-[18px] sm:text-xl font-bold text-ink tracking-[-0.02em] leading-tight">
            Earn <span className="text-success">{cashbackPercent}% back</span> on
            anything you buy on Amazon
          </h2>
          <p className="mt-1 text-[13px] sm:text-sm text-ink-2 max-w-xl leading-relaxed">
            Paste any Amazon product link to shop it through Havlo. Join the
            waitlist and we&apos;ll email you the moment it goes live.
          </p>

          <form onSubmit={onSubmit} className="mt-4 flex gap-2">
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
              placeholder="Paste an Amazon product link..."
              aria-label="Paste an Amazon product link"
              aria-invalid={error}
              className="flex-1 min-w-0 rounded-full border border-border bg-bg px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-success transition-colors"
            />
            <button
              type="submit"
              className="shrink-0 inline-flex items-center justify-center rounded-full bg-success text-white font-semibold text-sm px-5 sm:px-6 py-3 hover:opacity-90 transition-opacity"
            >
              Shop it
            </button>
          </form>
          {error && (
            <p className="mt-1.5 text-[12px] text-error">
              That doesn&apos;t look like an Amazon link. Paste a full product
              URL, e.g. amazon.com/...
            </p>
          )}

          <Link
            href={`/${countryCode}/cashback`}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-success hover:gap-2.5 transition-all"
          >
            Join the waitlist
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
