import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/providers/db-client";
import { isVotableRoadmapId } from "@/lib/data/roadmap";

/* /api/roadmap — vote counts + voting for the public roadmap.

   GET    → { counts, clientId } — counts and the caller's persistent
            client id (a cookie set on first call). The client uses it
            so it can vote and un-vote even from networks where many
            users share an IP (Nigerian mobile carriers NAT thousands
            behind a few ranges, popular phones share user-agents, so an
            ip+ua hash would silently drop a second real user's vote).
   POST   { featureId } → { ok } — idempotent insert keyed on
            (feature_id, voter_hash) where voter_hash now hashes the
            client id, not the request.
   DELETE { featureId } → { ok } — retract a vote (misclick / changed
            mind). PostHog-style un-vote rather than down-vote: still
            measures pull, no drive-by negativity. */

export const dynamic = "force-dynamic";

const CLIENT_ID_COOKIE = "havlo_rmid";
const CLIENT_ID_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

function voterHashFor(clientId: string): string {
  const salt = process.env.ROADMAP_VOTE_SALT || "havlo-roadmap";
  return createHash("sha256").update(`${salt}:${clientId}`).digest("hex");
}

/** Read or mint a per-browser client id (random uuid in an httpOnly,
    sameSite=lax cookie). httpOnly so JS can't read/forge it; the client
    receives its own id back from the JSON body of any roadmap call. */
function ensureClientId(req: NextRequest): { clientId: string; setCookie: string | null } {
  const existing = req.cookies.get(CLIENT_ID_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return { clientId: existing, setCookie: null };
  }
  const fresh = randomUUID();
  const cookie =
    `${CLIENT_ID_COOKIE}=${fresh}; Path=/; Max-Age=${CLIENT_ID_MAX_AGE}; ` +
    `HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  return { clientId: fresh, setCookie: cookie };
}

function withCookie(res: NextResponse, setCookie: string | null): NextResponse {
  if (setCookie) res.headers.append("set-cookie", setCookie);
  return res;
}

export async function GET(req: NextRequest) {
  const { clientId, setCookie } = ensureClientId(req);
  const supa = getSupabaseAdmin();
  if (!supa) {
    return withCookie(NextResponse.json({ counts: {}, clientId }), setCookie);
  }

  const { data, error } = await supa.from("roadmap_votes").select("feature_id");
  const counts: Record<string, number> = {};
  if (!error && data) {
    for (const row of data as Array<{ feature_id: string }>) {
      counts[row.feature_id] = (counts[row.feature_id] ?? 0) + 1;
    }
  }
  return withCookie(
    NextResponse.json({ counts, clientId }, { headers: { "cache-control": "private, no-store" } }),
    setCookie,
  );
}

export async function POST(req: NextRequest) {
  const { clientId, setCookie } = ensureClientId(req);

  let featureId: unknown;
  try {
    ({ featureId } = await req.json());
  } catch {
    return withCookie(NextResponse.json({ error: "Invalid body" }, { status: 400 }), setCookie);
  }
  if (typeof featureId !== "string" || !isVotableRoadmapId(featureId)) {
    return withCookie(NextResponse.json({ error: "Unknown feature" }, { status: 400 }), setCookie);
  }

  const supa = getSupabaseAdmin();
  if (!supa) return withCookie(NextResponse.json({ ok: true }), setCookie);

  /* Idempotent insert — the (feature_id, voter_hash) unique constraint
     turns a repeat vote into a no-op rather than an error the user
     sees. Table missing (pre-migration) or transient → accept the
     gesture, don't surface an error for a vote. */
  await supa
    .from("roadmap_votes")
    .upsert(
      { feature_id: featureId, voter_hash: voterHashFor(clientId) },
      { onConflict: "feature_id,voter_hash", ignoreDuplicates: true },
    );

  return withCookie(NextResponse.json({ ok: true }), setCookie);
}

export async function DELETE(req: NextRequest) {
  const { clientId, setCookie } = ensureClientId(req);

  let featureId: unknown;
  try {
    ({ featureId } = await req.json());
  } catch {
    return withCookie(NextResponse.json({ error: "Invalid body" }, { status: 400 }), setCookie);
  }
  if (typeof featureId !== "string" || !isVotableRoadmapId(featureId)) {
    return withCookie(NextResponse.json({ error: "Unknown feature" }, { status: 400 }), setCookie);
  }

  const supa = getSupabaseAdmin();
  if (!supa) return withCookie(NextResponse.json({ ok: true }), setCookie);

  /* Un-vote: delete this client's row for the feature. No-op when no
     row exists (the user wasn't voted), so the client can call this
     freely. */
  await supa
    .from("roadmap_votes")
    .delete()
    .eq("feature_id", featureId)
    .eq("voter_hash", voterHashFor(clientId));

  return withCookie(NextResponse.json({ ok: true }), setCookie);
}
