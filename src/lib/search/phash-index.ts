/* ─────────────────────────────────────────────────────────────────
   In-process perceptual-hash index for image → product lookup.

   Why an app-side index (not a SQL query):
     Supabase access here is the READ-ONLY service-role key — we can
     SELECT but we can't CREATE the proximity RPC (a hamming-distance
     k-NN function) or the supporting BK-tree / LSH index that a
     server-side nearest-neighbour search would want. So we pull the
     (id, title, image_phash) triples once, hold them in module
     memory, and scan them in JS with hammingDistance(). At ~10k
     hashed products a full scan is sub-millisecond — the same
     sequential-scan tradeoff migration 0050 documents for the
     query path.

   Caching:
     Module-level singleton with a TTL + single in-flight promise so
     concurrent requests during a cold window share one DB load
     instead of stampeding the read-only pool. Refreshed lazily on
     the first request past the TTL. Bounded cost: one paginated
     scan (~10 round-trips of 1000 rows) per TTL window, regardless
     of upload volume.

   This module performs NO image work and calls NO paid API — it is
   pure DB-read + in-memory bit math. The matching algorithm is the
   local dHash in ./phash. ───────────────────────────────────────── */

import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { hammingDistance } from "./phash";

interface PhashEntry {
  id:    string;
  title: string;
  phash: bigint;
}

/* 30-minute freshness. New products are hashed by the Mon/Thu
   backfill, so a half-hour-stale index never misses a flagship for
   long, and the homepage/compare upload control isn't worth a tighter
   window's egress. */
const INDEX_TTL_MS = 30 * 60_000;

/* PostgREST caps a single SELECT at 1000 rows by default; page with
   .range() until a short page signals the end. */
const PAGE = 1000;

/* Hard ceiling so a runaway/duplicated catalog can't balloon the
   in-memory index without bound. 50k × ~120 bytes ≈ 6MB worst case. */
const MAX_ENTRIES = 50_000;

let cache: { at: number; entries: PhashEntry[] } | null = null;
let inflight: Promise<PhashEntry[]> | null = null;

async function loadIndex(): Promise<PhashEntry[]> {
  const supa = getSupabaseAdmin();
  if (!supa) return [];

  const entries: PhashEntry[] = [];
  for (let from = 0; from < MAX_ENTRIES; from += PAGE) {
    const { data, error } = await supa
      .from("products")
      .select("id, title, image_phash")
      .not("image_phash", "is", null)
      .range(from, from + PAGE - 1);

    if (error) {
      /* Surface the failure but keep whatever we paged so far — a
         partial index still answers most uploads. A totally empty
         result just means "no match" downstream, which the UI
         handles gracefully. */
      console.error("[phash-index] load page failed", { from, error: error.message });
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data as Array<{ id: string; title: string | null; image_phash: string | number | null }>) {
      if (r.image_phash == null) continue;
      try {
        /* image_phash is a signed BIGINT; PostgREST hands it back as
           a string (or number). BigInt() round-trips both — the same
           conversion variant-pooling-deep uses on this column. */
        entries.push({ id: r.id, title: r.title ?? "", phash: BigInt(r.image_phash) });
      } catch {
        /* Unparseable hash (shouldn't happen for a BIGINT column) —
           skip the row rather than fail the whole load. */
      }
    }
    if (data.length < PAGE) break;
  }
  return entries;
}

/** Get the cached phash index, loading (and caching) it on the first
    call or after the TTL expires. Concurrent callers during a cold
    window all await the same in-flight load. */
export async function getPhashIndex(): Promise<PhashEntry[]> {
  if (cache && Date.now() - cache.at < INDEX_TTL_MS) return cache.entries;
  if (inflight) return inflight;

  inflight = loadIndex()
    .then((entries) => {
      cache = { at: Date.now(), entries };
      return entries;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export interface PhashMatch {
  productId: string;
  title:     string;
  distance:  number;
}

/** Nearest catalog product to `phash` by Hamming distance, or null
    when the index is empty. The caller applies the accept threshold
    — this returns the best candidate regardless of distance so the
    route can log/inspect near-misses. */
export async function findNearestByPhash(phash: bigint): Promise<PhashMatch | null> {
  const index = await getPhashIndex();
  let best: PhashMatch | null = null;
  for (const e of index) {
    const d = hammingDistance(phash, e.phash);
    if (best === null || d < best.distance) {
      best = { productId: e.id, title: e.title, distance: d };
      if (d === 0) break; // exact bit-match — nothing can beat it
    }
  }
  return best;
}
