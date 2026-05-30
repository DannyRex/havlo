import { Suspense } from "react";
import { headers } from "next/headers";
import NewsletterStrip from "@/components/landing/NewsletterStrip";
import DealUnavailableBanner from "@/components/feedback/DealUnavailableBanner";
import CompareContent from "./CompareContent";
import { getCountry } from "@/lib/country";
import type { SearchOutput } from "@/lib/search";

/* Mirrors looksLikeUrl in ./CompareContent — duplicated (3 lines) so
   this server component doesn't import the "use client" module just for
   a helper. A pasted product URL is resolved by the client-side sniff
   flow (interactive: sniff → build anchor → fetch dupes), so we
   deliberately do NOT SSR-fetch for it. */
function looksLikeUrl(v: string): boolean {
  const t = v.trim();
  return /^https?:\/\//i.test(t) || /^(www\.|[a-z]+\.(com|ng|co))/i.test(t);
}

/* ── Server-side compare fetch ─────────────────────────────────────
   SSR the first internal comparison result for a deep-linked query so
   a shared / crawled /compare?q=… (or ?key=, ?oid=) URL paints real
   anchor + dupes in the initial HTML, instead of the old client
   waterfall: download JS → hydrate → fire /api/compare → wait → paint.

   Calls our own /api/compare so SSR uses identical logic + cache as the
   client's later calls — no drift between "what the server resolved"
   and "what the client would have". Country is passed EXPLICITLY (the
   API honours ?country=) rather than relying on a forwarded cookie, so
   /uk/compare always resolves UK offers server-side. The fetch URL is
   absolute because Node fetch can't resolve a relative path.

   Only a NON-empty result is returned to seed the client. An empty or
   failed SSR result returns null, so the client's own mount fetch runs
   instead — that path owns the empty-state UI + live-search recovery
   and can retry a transient miss rather than locking it into the SSR
   data cache. Errors fail open to null (client still renders + fetches). */
async function fetchInitialCompare(args: {
  country: string;
  q?: string;
  key?: string;
  pid?: string;
  oid?: string;
}): Promise<SearchOutput | null> {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "havlo.io";
    const proto = h.get("x-forwarded-proto") ?? "https";

    const qs = new URLSearchParams();
    qs.set("country", args.country);
    if (args.key) {
      qs.set("key", args.key);
    } else {
      /* Mirror the client's handleSearch params exactly: q (raw, as it
         arrived in the URL) + mode=similar, with pid/oid backstops. */
      qs.set("q", args.q ?? "");
      qs.set("mode", "similar");
      if (args.pid) qs.set("pid", args.pid);
      if (args.oid) qs.set("oid", args.oid);
    }

    const url = `${proto}://${host}/api/compare?${qs.toString()}`;
    /* 5-min SSR fetch cache. Compare results are far more stable than
       the rotating deals feed — a product's cross-store offers don't
       churn second-to-second — so a deep link shared widely hits a warm
       cache instead of re-running FTS + variant pooling on every visit.
       The client never refetches the seeded result, so the only
       freshness cost is up to 5 min on a price change, well inside the
       scraper's own cadence. */
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error(`[fetchInitialCompare] /api/compare returned ${res.status}`, { url });
      return null;
    }
    const data = (await res.json()) as SearchOutput;
    /* Seed only on real content — see the function header. */
    if (!data || data.mode === "empty") return null;
    return data;
  } catch (err) {
    console.error("[fetchInitialCompare] threw", (err as Error).message);
    return null;
  }
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: { country: string };
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const country = getCountry(params.country);

  const pickFirst = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  /* qRaw is sent verbatim to /api/compare (matches the client); the
     trimmed copy is only used for the SSR-eligibility decision. */
  const qRaw = pickFirst("q") ?? "";
  const q = qRaw.trim();
  const key = pickFirst("key") ?? "";
  const pid = pickFirst("pid") ?? "";
  const oid = pickFirst("oid") ?? "";

  /* SSR the internal result only for the deep-linked, non-URL queries
     the client would otherwise resolve via /api/compare on mount:
       · key= → direct keyed lookup
       · q=   → text search (a pasted URL is skipped — it uses the
                client sniff flow)
       · oid= → PDP offer-id backstop (works with an empty q)
     A bare /compare (no params) does NO server fetch: it renders the
     instant search-bar + chip-rail shell exactly as before, so the most
     common landing stays cheap. */
  const isUrlQuery = q.length > 0 && looksLikeUrl(q);
  const shouldSsr = !!key || !!oid || (q.length > 0 && !isUrlQuery);
  const initialResult = shouldSsr
    ? await fetchInitialCompare({ country: country.code, q: qRaw, key, pid, oid })
    : null;

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-12 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-border border-t-brand animate-spin" />
        </div>
      }
    >
      {/* Recovery banner — sits above the search bar when /api/go
          bounced the user back here with deal_unavailable=1. Inside the
          Suspense boundary because it reads useSearchParams. */}
      <DealUnavailableBanner />
      {/* key={params.country} — force a remount on country switch so
          CompareContent re-seeds for the new market instead of showing a
          stale result (offers / prices / anchor) from the old country
          context. Mirrors key={country.code} on DealFeed in
          /[country]/deals/page.tsx, which fixed the same class of bug. */}
      <CompareContent key={params.country} initialResult={initialResult} />
      {/* Newsletter signup after results. Added May 2026
          launch-readiness pass — was previously homepage-only. */}
      <NewsletterStrip />
    </Suspense>
  );
}
