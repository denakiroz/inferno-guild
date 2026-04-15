// GET /api/admin/events/[id]/matches  — list matches with party names
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireEditor() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await getSession(sid);
  if (!session || !(session.isAdmin || session.isHead)) return null;
  return session;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id: eventId } = await params;

    const { data, error } = await supabaseAdmin
      .from("event_matches")
      .select("id,round,match_order,status,winner_party_id,played_at,party1_id,party2_id")
      .eq("event_id", eventId)
      .order("round")
      .order("match_order");

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Get party names
    const { data: parties } = await supabaseAdmin
      .from("event_parties")
      .select("id,name,color")
      .eq("event_id", eventId);

    const partyMap = new Map((parties ?? []).map((p) => [p.id, p]));

    const items = (data ?? []).map((m) => ({
      ...m,
      party1: partyMap.get(m.party1_id) ?? null,
      party2: partyMap.get(m.party2_id) ?? null,
      winner: m.winner_party_id ? partyMap.get(m.winner_party_id) ?? null : null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
