"use client";

/* Layered recovery for searches that returned zero matches.
   Used on:
     - /deals when filter results are empty
     - /[country]/compare when both DB + live providers came back dry

   Three exits, in this order:
     1) URL paste — routes to /[country]/compare?q=<url>&mode=similar
        which kicks /api/sniff into structured-data extraction. Often
        finds matches our keyword index missed because sniff has an
        image + price + exact title to similarity-match against the
        catalog, not just words.
     2) Notify-me email capture — POST /api/notify-product. User gets
        emailed when the query starts returning results (Phase 2);
        the request also feeds catalog-demand intelligence.
     3) Browse fallback — link to /deals when the user really just
        wants to see SOMETHING.

   Why all three: different users, different next moves. The URL-paste
   user has shopped before and knows what they want. The notify-me user
   is patient. The browse user is exploring. Showing all three captures
   each segment instead of forcing one path. */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Link as LinkIcon, Bell, ArrowRight, Check } from "lucide-react";
import { useCountry } from "@/components/providers/CountryProvider";

interface Suggestion {
  title: string;
  key:   string;
}

interface Props {
  /** What the user searched for. Echoed back so the empty state isn't generic. */
  query: string;
  /** Where this is rendered. Used as the `source` for analytics + notify-me data. */
  source: "deals" | "compare";
  /** Optional: override the default browse-fallback link. */
  browseHref?: string;
  /**
   * 'Did you mean' suggestions from the trigram-similarity fallback.
   * Rendered as clickable pills above the three recovery options.
   * Empty array = no suggestions shown.
   */
  suggestions?: Suggestion[];
}

function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  return /^https?:\/\//i.test(t) || /^(www\.|[a-z]+\.(com|ng|co|io|de|in|ae))/i.test(t);
}

export default function EmptySearchState({ query, source, browseHref, suggestions = [] }: Props) {
  const router  = useRouter();
  const { country } = useCountry();

  /* Skip the URL-paste recovery option when the user's query was
     already a URL. Asking 'paste a product URL' on top of a failed
     URL search reads as 'we ignored what you sent us, try again',
     which is wrong and frustrating. They already tried that path;
     show them the other recovery options instead. */
  const isUrlQuery = looksLikeUrl(query);

  const [url, setUrl]               = useState("");
  const [urlError, setUrlError]     = useState<string | null>(null);

  const [email, setEmail]           = useState("");
  const [notifyState, setNotifyState] =
    useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const fallbackHref = browseHref ?? `/${country.code}/deals`;

  /* ── URL paste handler ──────────────────────────────────────────── */
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const v = url.trim();
    if (!v) {
      setUrlError("Paste a product link first.");
      return;
    }
    if (!looksLikeUrl(v)) {
      setUrlError("That doesn't look like a URL. Make sure it starts with https://");
      return;
    }
    /* Hand off to /compare in URL mode — it'll sniff + match. */
    router.push(`/${country.code}/compare?q=${encodeURIComponent(v)}&mode=similar`);
  };

  /* ── Notify-me handler ──────────────────────────────────────────── */
  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifyError(null);

    const v = email.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setNotifyError("Enter a valid email address.");
      return;
    }

    setNotifyState("submitting");
    try {
      const res = await fetch("/api/notify-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query, email: v, country: country.code, source,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setNotifyError(data.error ?? "Couldn't save request. Try again?");
        setNotifyState("error");
        return;
      }
      setNotifyState("ok");
    } catch {
      setNotifyError("Couldn't reach the server. Try again?");
      setNotifyState("error");
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10 sm:py-14 px-4">

      {/* Heading */}
      <div className="text-center mb-6">
        <Search size={28} className="text-ink-3 mx-auto mb-3" strokeWidth={1.5} />
        <h3 className="text-base sm:text-lg font-semibold text-ink mb-1.5 leading-snug">
          {query
            ? <>Nothing found for &ldquo;{query}&rdquo;</>
            : <>Nothing matches those filters</>
          }
        </h3>
        {suggestions.length === 0 && (
          <p className="text-sm text-ink-3 leading-relaxed">
            {isUrlQuery
              ? "We couldn't find this in the catalog yet. Pick a way forward."
              : "Three ways forward. Pick whichever fits."}
          </p>
        )}
      </div>

      {/* Did-you-mean pills — closest matching titles via trigram
          similarity. Rendered before the recovery options because a
          one-click correction is the lowest-friction path back. Routes
          to /[country]/compare?q=<title> so the user sees a fresh
          search-results view instead of jumping to a single product. */}
      {suggestions.length > 0 && (
        <div className="text-center mb-7">
          <p className="text-xs text-ink-3 uppercase tracking-[0.08em] mb-2.5 font-semibold">
            Did you mean
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {suggestions.map((s) => (
              <Link
                key={s.key}
                href={`/${country.code}/compare?q=${encodeURIComponent(s.title)}`}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-border border border-border text-[13px] text-ink hover:text-ink transition-colors"
              >
                {s.title.length > 50 ? `${s.title.slice(0, 47)}…` : s.title}
              </Link>
            ))}
          </div>
          <p className="text-sm text-ink-3 leading-relaxed mt-5">
            Or pick a different way forward.
          </p>
        </div>
      )}

      {/* Option 1 — URL paste (primary, highlighted). Hidden when the
          user's query was itself a URL — they already tried that path;
          showing it again reads as 'we ignored your input.' */}
      {!isUrlQuery && (
      <div className="rounded-2xl border border-border-strong bg-surface p-4 sm:p-5 mb-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center">
            <LinkIcon size={16} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink leading-snug">
              Have a link to it?
            </p>
            <p className="text-[13px] text-ink-2 mt-0.5 leading-relaxed">
              Paste a product URL from any store and we&apos;ll find cheaper alternatives.
            </p>
          </div>
        </div>

        <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
            placeholder="https://amazon.com/..."
            aria-label="Product URL"
            className="flex-1 px-3.5 py-2.5 rounded-full text-[14px] bg-bg border border-border focus:border-brand focus:shadow-input outline-none transition-all"
            style={{ fontSize: "16px" }}
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-full bg-ink text-bg text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5"
          >
            Find
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </form>
        {urlError && (
          <p className="text-xs text-error mt-2 px-1">{urlError}</p>
        )}
      </div>
      )}

      {/* Option 2 — Notify me */}
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 mb-3">
        {notifyState === "ok" ? (
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-success/10 text-success flex items-center justify-center">
              <Check size={16} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink leading-snug">
                We&apos;ll let you know
              </p>
              <p className="text-[13px] text-ink-2 mt-0.5 leading-relaxed">
                Once Havlo finds matches for &ldquo;{query}&rdquo;, you&apos;ll get an email.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-surface-2 text-ink-2 flex items-center justify-center">
                <Bell size={16} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink leading-snug">
                  Tell me when you find it
                </p>
                <p className="text-[13px] text-ink-2 mt-0.5 leading-relaxed">
                  Leave your email and we&apos;ll ping you when this shows up.
                </p>
              </div>
            </div>

            <form onSubmit={handleNotifySubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setNotifyError(null); }}
                placeholder="you@example.com"
                aria-label="Email address"
                disabled={notifyState === "submitting"}
                className="flex-1 px-3.5 py-2.5 rounded-full text-[14px] bg-bg border border-border focus:border-brand focus:shadow-input outline-none transition-all disabled:opacity-60"
                style={{ fontSize: "16px" }}
              />
              <button
                type="submit"
                disabled={notifyState === "submitting"}
                className="px-5 py-2.5 rounded-full bg-surface-2 text-ink text-sm font-semibold hover:bg-border transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {notifyState === "submitting" ? "Saving…" : "Notify me"}
              </button>
            </form>
            {notifyError && (
              <p className="text-xs text-error mt-2 px-1">{notifyError}</p>
            )}
          </>
        )}
      </div>

      {/* Option 3 — Browse fallback */}
      <div className="text-center pt-2">
        <Link
          href={fallbackHref}
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors"
        >
          Or browse trending deals
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
