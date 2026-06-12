import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { isVotableRoadmapId } from "@/lib/data/roadmap";

/* /api/roadmap — vote counts + voting for the public roadmap.

   GET  → { counts: { [featureId]: number } }
   POST { featureId } → { ok, count } — one vote per (feature, voter).

   Voter identity is a salted hash of ip + user-agent: good enough to
   stop casual repeat-voting without storing any PII or requiring
   accounts. The unique constraint in roadmap_votes (migration 0078)
   makes repeats idempotent; the client also disables voted buttons via
   localStorage. Both handlers degrade gracefully (empty counts /
   accepted-but-uncounted) when the table hasn't been migrated yet, so
   the page never breaks on a fresh environment. */

export const dynamic = "force-dynamic";

function voterHash(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  const salt = process.env.ROADMAP_VOTE_SALT || "havlo-roadmap";
  return createHash("sha256").update(`${salt}:${ip}:${ua}`).digest("hex");
}

export async function GET() {
  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ counts: {} });

  const { data, error } = await supa
    .from("roadmap_votes")
    .select("feature_id");
  if (error || !data) return NextResponse.json({ counts: {} });

  const counts: Record<string, number> = {};
  for (const row of data as Array<{ feature_id: string }>) {
    counts[row.feature_id] = (counts[row.feature_id] ?? 0) + 1;
  }
  return NextResponse.json(
    { counts },
    { headers: { "cache-control": "public, max-age=0, s-maxage=60" } },
  );
}

export async function POST(req: NextRequest) {
  let featureId: unknown;
  try {
    ({ featureId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof featureId !== "string" || !isVotableRoadmapId(featureId)) {
    return NextResponse.json({ error: "Unknown feature" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  if (!supa) return NextResponse.json({ ok: true, count: null });

  /* Idempotent insert — the (feature_id, voter_hash) unique constraint
     turns a repeat vote into a no-op rather than an error the user
     sees. */
  const { error: insErr } = await supa
    .from("roadmap_votes")
    .upsert(
      { feature_id: featureId, voter_hash: voterHash(req) },
      { onConflict: "feature_id,voter_hash", ignoreDuplicates: true },
    );
  if (insErr) {
    /* Table missing (pre-migration) or transient — accept the gesture,
       don't surface an error for a vote. */
    return NextResponse.json({ ok: true, count: null });
  }

  const { count } = await supa
    .from("roadmap_votes")
    .select("id", { count: "exact", head: true })
    .eq("feature_id", featureId);
  return NextResponse.json({ ok: true, count: count ?? null });
}
