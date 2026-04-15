// PATCH  /api/admin/events/[id]/parties/[pid]  — rename / recolor party
// DELETE /api/admin/events/[id]/parties/[pid]  — delete party
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { pid } = await params;
    const body = await req.json().catch(() => ({}));

    const updates: Record<string, unknown> = {};
    if ("name"  in body) updates.name  = String(body.name  ?? "").trim() || null;
    if ("color" in body) updates.color = String(body.color ?? "").trim() || null;

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });

    const { error } = await supabaseAdmin.from("event_parties").update(updates).eq("id", pid);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { pid } = await params;
    const { error } = await supabaseAdmin.from("event_parties").delete().eq("id", pid);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
