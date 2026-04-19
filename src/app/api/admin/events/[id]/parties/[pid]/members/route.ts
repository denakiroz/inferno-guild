// POST   /api/admin/events/[id]/parties/[pid]/members  — add member to party
// DELETE /api/admin/events/[id]/parties/[pid]/members  — remove member (body: {discord_user_id})
// PATCH  /api/admin/events/[id]/parties/[pid]/members  — reorder (body: {order: string[]})
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

const MAX_PARTY_SIZE = 6;

export async function POST(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { pid } = await params;
    const body = await req.json().catch(() => ({}));
    const discord_user_id = String(body?.discord_user_id ?? "").trim();
    const member_name     = String(body?.member_name     ?? "").trim() || null;
    const rawPos          = body?.position;
    let position: number | null =
      typeof rawPos === "number" && Number.isInteger(rawPos) ? rawPos : null;

    if (!discord_user_id)
      return NextResponse.json({ ok: false, error: "discord_user_id required" }, { status: 400 });

    // ── Validate slots ──
    const { data: existing } = await supabaseAdmin
      .from("event_party_members")
      .select("position,discord_user_id")
      .eq("party_id", pid);

    const others = (existing ?? []).filter((e) => e.discord_user_id !== discord_user_id);
    const already = (existing ?? []).find((e) => e.discord_user_id === discord_user_id);

    // ปาร์ตี้เต็ม
    if (!already && others.length >= MAX_PARTY_SIZE) {
      return NextResponse.json({ ok: false, error: "ปาร์ตี้เต็มแล้ว (6/6)" }, { status: 409 });
    }

    if (position != null) {
      if (position < 0 || position >= MAX_PARTY_SIZE) {
        return NextResponse.json({ ok: false, error: "position ต้องอยู่ 0–5" }, { status: 400 });
      }
      // position ซ้ำกับคนอื่น?
      const taken = others.find((o) => o.position === position);
      if (taken) {
        return NextResponse.json({ ok: false, error: "ตำแหน่งนี้มีคนอยู่แล้ว" }, { status: 409 });
      }
    } else {
      // ไม่ระบุ → หา slot ว่างแรก
      const usedSet = new Set(others.map((o) => o.position));
      for (let i = 0; i < MAX_PARTY_SIZE; i++) {
        if (!usedSet.has(i)) { position = i; break; }
      }
      if (position == null) {
        return NextResponse.json({ ok: false, error: "ไม่มี slot ว่าง" }, { status: 409 });
      }
    }

    const { error } = await supabaseAdmin
      .from("event_party_members")
      .upsert(
        { party_id: pid, discord_user_id, member_name, position },
        { onConflict: "party_id,discord_user_id" }
      );

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, position });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { pid } = await params;
    const body = await req.json().catch(() => ({}));
    const order: string[] | null = Array.isArray(body?.order)
      ? (body.order as unknown[]).map((v) => String(v))
      : null;

    if (!order || order.length === 0)
      return NextResponse.json({ ok: false, error: "order required" }, { status: 400 });

    // update position ตาม index (0, 1, 2, ...) — parallel
    const updates = order.map((uid, i) =>
      supabaseAdmin
        .from("event_party_members")
        .update({ position: i })
        .eq("party_id", pid)
        .eq("discord_user_id", uid)
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error);
    if (firstErr?.error)
      return NextResponse.json({ ok: false, error: firstErr.error.message }, { status: 500 });

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
