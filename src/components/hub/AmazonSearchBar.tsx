"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/* AmazonSearchBar — bring ANY Amazon product to Havlo so you can shop it
   through us and earn cashback, even when it's not one of the markdowns
   we track.

   Two inputs, one box:
     • Paste an Amazon product link -> hand to the compare/sniff flow
       (/[country]/compare?q=<url>&mode=similar). It finds the product,
       surfaces cheaper matches, and its outbound Amazon click goes through
       /api/go (tagged) so the purchase qualifies for cashback.
     • Type a product name -> search Amazon's full catalogue (tagged) via
       /api/amazon-search, opened in a new tab. */

function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  return (
    /^https?:\/\//i.test(t) ||
    /^www\./i.test(t) ||
    /\b[a-z0-9-]+\.(com|co\.uk|de|ae|in|co\.za|ng|net|io)\b/i.test(t)
  );
}

export default function AmazonSearchBar({
  countryCode,
  cashbackPercent,
}: {
  countryCode: string;
  cashbackPercent: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;

    if (looksLikeUrl(v)) {
      const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      router.push(
        `/${countryCode}/compare?q=${encodeURIComponent(url)}&mode=similar`,
      );
    } else {
      window.open(
        `/api/amazon-search?q=${encodeURIComponent(v)}&country=${encodeURIComponent(countryCode)}`,
        "_blank",
        "noopener",
      );
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-border bg-surface-2 p-5 sm:p-6">
      <h2 className="text-[18px] sm:text-xl font-bold text-ink tracking-[-0.02em] leading-tight">
        Shop any Amazon product through Havlo
      </h2>
      <p className="mt-1 text-[13px] sm:text-sm text-ink-2 max-w-xl leading-relaxed">
        Paste an Amazon link and we will find the product for you, surface any
        cheaper match, and route you through Havlo so you earn {cashbackPercent}%
        cashback (coming soon). No link? Type a product to search Amazon&apos;s
        full catalogue.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            type="text"
            inputMode="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={2048}
            enterKeyHint="go"
            autoComplete="off"
            placeholder="Paste an Amazon link, or search Amazon..."
            aria-label="Paste an Amazon link or search Amazon"
            className="w-full rounded-full border border-border bg-bg pl-11 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-brand transition-colors"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-ink text-bg font-semibold text-sm px-5 sm:px-6 py-3 hover:opacity-90 transition-opacity"
        >
          Find it
        </button>
      </form>
    </section>
  );
}
