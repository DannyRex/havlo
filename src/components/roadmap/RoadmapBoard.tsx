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
import { ROADMAP_ITEMS, type RoadmapItem, type RoadmapStatus } from "@/lib/data/roadmap";

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

export default function RoadmapBoard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVoted(readVoted());
    fetch("/api/roadmap")
      .then((r) => (r.ok ? r.json() : { counts: {} }))
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => {});
  }, []);

  function vote(id: string) {
    if (voted.has(id)) return;
    /* Optimistic: bump locally first; the POST result reconciles. */
    const next = new Set(voted).add(id);
    setVoted(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(Array.from(next))); } catch {}
    setCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
    fetch("/api/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureId: id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === "number") {
          setCounts((c) => ({ ...c, [id]: d.count }));
        }
      })
      .catch(() => {});
  }

  return (
    <div className="space-y-12">
      {GROUPS.map(({ status, title, blurb }) => {
        const items = ROADMAP_ITEMS.filter((i) => i.status === status);
        if (items.length === 0) return null;
        return (
          <section key={status} aria-labelledby={`roadmap-${status}`}>
            <div className="mb-4">
              <h2 id={`roadmap-${status}`} className="text-lg sm:text-xl font-bold text-ink tracking-[-0.01em]">
                {title}
              </h2>
              <p className="text-sm text-ink-3 mt-0.5">{blurb}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <RoadmapCard
                  key={item.id}
                  item={item}
                  count={counts[item.id] ?? 0}
                  voted={voted.has(item.id)}
                  onVote={() => vote(item.id)}
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
  item, count, voted, onVote,
}: {
  item: RoadmapItem;
  count: number;
  voted: boolean;
  onVote: () => void;
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
          onClick={onVote}
          disabled={voted}
          aria-pressed={voted}
          aria-label={voted ? `Voted for ${item.title}` : `Vote for ${item.title}`}
          className={`shrink-0 flex flex-col items-center justify-center w-12 min-h-[44px] rounded-xl border text-xs font-semibold transition-colors ${
            voted
              ? "border-success/40 bg-success/10 text-success cursor-default"
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
