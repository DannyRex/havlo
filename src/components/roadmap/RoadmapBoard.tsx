"use client";

/* Interactive board for /roadmap — three columns (Up next / Exploring /
   Shipped) with one-tap voting on the first two.

   Voting is deliberately friction-free: no account, no dialog. The
   server dedupes by a salted ip+ua hash; the client mirrors that with
   localStorage so a voted button stays in its voted state across
   visits. Counts come from /api/roadmap on mount and update
   optimistically on vote — if the votes table isn't migrated yet the
   page still renders with the chevrons at 0, which reads as "be the
   first to vote" rather than broken. */

import { useEffect, useState } from "react";
import { ChevronUp, CheckCircle2 } from "lucide-react";
import type { RoadmapItem, RoadmapStatus } from "@/lib/data/roadmap";

/* localStorage stays as a UX optimization (instant voted-state on
   first paint, before the API round-trip resolves). The server is the
   source of truth — it dedupes by a per-browser client id cookie, so
   clearing storage doesn't add a duplicate count. */
const LS_KEY = "havlo-roadmap-votes";

const GROUPS: Array<{ status: RoadmapStatus; title: string; blurb: string }> = [
  { status: "up-next",   title: "Up next",   blurb: "Committed. Being built or next in line." },
  { status: "exploring", title: "Exploring", blurb: "Your votes decide what gets built first." },
  { status: "shipped",   title: "Shipped",   blurb: "Live on Havlo today." },
];

function readVoted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export default function RoadmapBoard({ items }: { items: RoadmapItem[] }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVoted(readVoted());
    fetch("/api/roadmap")
      .then((r) => (r.ok ? r.json() : { counts: {} }))
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => {});
  }, []);

  /* Toggle: if not voted → POST and bump; if voted → DELETE and decrement.
     Optimistic everywhere; on network error we revert the local state so
     the button never lies. */
  function toggleVote(id: string) {
    const isVoted = voted.has(id);
    const next = new Set(voted);
    if (isVoted) next.delete(id); else next.add(id);
    setVoted(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(Array.from(next))); } catch {}
    setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (isVoted ? -1 : 1)) }));

    fetch("/api/roadmap", {
      method: isVoted ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId: id }),
    }).catch(() => {
      /* Revert on failure so the UI keeps matching reality. */
      const revert = new Set(voted);
      if (isVoted) revert.add(id); else revert.delete(id);
      setVoted(revert);
      try { localStorage.setItem(LS_KEY, JSON.stringify(Array.from(revert))); } catch {}
      setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (isVoted ? 1 : -1)) }));
    });
  }

  return (
    <div className="space-y-12">
      {GROUPS.map(({ status, title, blurb }) => {
        const groupItems = items.filter((i) => i.status === status);
        if (groupItems.length === 0) return null;
        return (
          <section key={status} aria-labelledby={`roadmap-${status}`}>
            <div className="mb-4">
              <h2 id={`roadmap-${status}`} className="text-lg sm:text-xl font-bold text-ink tracking-[-0.01em]">
                {title}
              </h2>
              <p className="text-sm text-ink-3 mt-0.5">{blurb}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {groupItems.map((item) => (
                <RoadmapCard
                  key={item.id}
                  item={item}
                  count={counts[item.id] ?? 0}
                  voted={voted.has(item.id)}
                  onToggle={() => toggleVote(item.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function RoadmapCard({
  item, count, voted, onToggle,
}: {
  item: RoadmapItem;
  count: number;
  voted: boolean;
  onToggle: () => void;
}) {
  const shipped = item.status === "shipped";
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      {shipped ? (
        <span className="mt-0.5 shrink-0 text-success" aria-hidden>
          <CheckCircle2 size={22} />
        </span>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={voted}
          aria-label={
            voted
              ? `You voted for ${item.title}. Tap again to retract your vote.`
              : `Vote for ${item.title}`
          }
          title={voted ? "Tap to remove your vote" : "Vote"}
          className={`shrink-0 flex flex-col items-center justify-center w-12 min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
            voted
              ? "border-success/40 bg-success/10 text-success hover:border-success/60"
              : "border-border bg-bg text-ink-2 hover:border-border-strong hover:text-ink"
          }`}
        >
          <ChevronUp size={16} aria-hidden />
          <span className="tabular-nums leading-none pb-1">{count}</span>
        </button>
      )}
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink leading-snug">{item.title}</h3>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">{item.description}</p>
      </div>
    </li>
  );
}
