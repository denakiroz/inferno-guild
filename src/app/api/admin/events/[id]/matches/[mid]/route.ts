// PATCH /api/admin/events/[id]/matches/[mid]
// Record match result: { winner_party_id: string | null }  null = reset to pending
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { mid } = await params;
    const body = await req.json().catch(() => ({}));

    const winner_party_id = body?.winner_party_id ?? null;

    const updates: Record<string, unknown> = {
      winner_party_id: winner_party_id || null,
      status:          winner_party_id ? "done" : "pending",
      played_at:       winner_party_id ? new Date().toISOString() : null,
    };

    const { error } = await supabaseAdmin
      .from("event_matches")
      .update(updates)
      .eq("id", mid);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
