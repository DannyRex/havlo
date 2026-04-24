/**
 * POST /api/click
 *
 * Records a click event when a user taps a deal or product group.
 * Feeds Phase 3 re-rank: deals clicked more often for a given query
 * get boosted in future Supabase ANN results.
 *
 * Body (JSON):
 *   {
 *     dealId:    string   // deal id from deals.ts
 *     query:     string   // the search query that surfaced this result
 *     position:  number   // 0-indexed rank position shown to user
 *     mode:      string   // "single" | "list" | "similar" — result mode
 *   }
 *
 * All fields are optional defensively — we never want a logging call to
 * error-out and break the UI.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupa() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  // Always return 204 — client should fire-and-forget, never await this.
  try {
    const body = await req.json().catch(() => ({}));
    const { dealId, query, position, mode } = body as {
      dealId?: string;
      query?: string;
      position?: number;
      mode?: string;
    };

    if (!dealId) return new NextResponse(null, { status: 204 });

    await getSupa()
      .from("clicks")
      .insert({
        deal_id:  dealId,
        query:    (query ?? "").slice(0, 300),
        position: position ?? null,
        mode:     mode ?? null,
        // `clicked_at` defaults to now() in the schema
      });
  } catch {
    // Swallow all errors — telemetry must never impact UX
  }

  return new NextResponse(null, { status: 204 });
}
