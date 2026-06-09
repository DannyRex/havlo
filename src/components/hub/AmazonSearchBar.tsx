import { Search } from "lucide-react";
import { getCashbackForStore } from "@/lib/cashback";

/* AmazonSearchBar — search the FULL Amazon catalogue, not just the
   markdowns Havlo tracks. The native form GETs /api/amazon-search, which
   builds the right marketplace search URL with our Associates tag and
   302s to it, so the click qualifies for cashback. Opens in a new tab so
   Havlo stays put. No client JS needed — works as a plain HTML form. */
export default function AmazonSearchBar({ countryCode }: { countryCode: string }) {
  const percent = getCashbackForStore("amazon")?.percent ?? 2;

  return (
    <section className="mb-8 rounded-2xl border border-border bg-surface-2 p-5 sm:p-6">
      <h2 className="text-[18px] sm:text-xl font-bold text-ink tracking-[-0.02em] leading-tight">
        Search all of Amazon
      </h2>
      <p className="mt-1 text-[13px] sm:text-sm text-ink-2 max-w-xl leading-relaxed">
        Cashback is not limited to the price drops below. Search Amazon&apos;s
        full catalogue, and you will earn {percent}% back on whatever you buy
        too once cashback goes live.
      </p>

      <form
        action="/api/amazon-search"
        method="GET"
        target="_blank"
        className="mt-4 flex gap-2"
      >
        <input type="hidden" name="country" value={countryCode} />
        <div className="relative flex-1">
          <Search
            size={18}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            name="q"
            required
            maxLength={150}
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search Amazon for anything..."
            aria-label="Search all of Amazon"
            className="w-full rounded-full border border-border bg-bg pl-11 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-brand transition-colors"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-ink text-bg font-semibold text-sm px-5 sm:px-6 py-3 hover:opacity-90 transition-opacity"
        >
          <Search size={16} strokeWidth={2.25} aria-hidden="true" className="sm:hidden" />
          <span className="hidden sm:inline">Search Amazon</span>
          <span className="sm:hidden sr-only">Search Amazon</span>
        </button>
      </form>
    </section>
  );
}
