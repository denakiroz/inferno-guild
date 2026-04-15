// POST   /api/admin/events/[id]/parties/[pid]/members  — add member to party
// DELETE /api/admin/events/[id]/parties/[pid]/members  — remove member (body: {discord_user_id})
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { pid } = await params;
    const body = await req.json().catch(() => ({}));
    const discord_user_id = String(body?.discord_user_id ?? "").trim();
    const member_name     = String(body?.member_name     ?? "").trim() || null;

    if (!discord_user_id)
      return NextResponse.json({ ok: false, error: "discord_user_id required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("event_party_members")
      .upsert({ party_id: pid, discord_user_id, member_name }, { onConflict: "party_id,discord_user_id" });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { pid } = await params;
    const body = await req.json().catch(() => ({}));
    const discord_user_id = String(body?.discord_user_id ?? "").trim();

    if (!discord_user_id)
      return NextResponse.json({ ok: false, error: "discord_user_id required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("event_party_members")
      .delete()
      .eq("party_id", pid)
      .eq("discord_user_id", discord_user_id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
