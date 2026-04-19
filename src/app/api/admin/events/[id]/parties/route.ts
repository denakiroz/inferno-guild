// GET  /api/admin/events/[id]/parties  — list parties with members
// POST /api/admin/events/[id]/parties  — create party
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

    const { data: parties, error: pErr } = await supabaseAdmin
      .from("event_parties")
      .select("id,name,color,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

    const partyIds = (parties ?? []).map((p) => p.id);
    let memberMap: Record<string, { discord_user_id: string; member_name: string; class_name: string; class_icon: string; position: number }[]> = {};

    if (partyIds.length > 0) {
      // order ตาม position asc เพื่อให้ลำดับสมาชิกใน party คงที่
      const { data: members } = await supabaseAdmin
        .from("event_party_members")
        .select("party_id,discord_user_id,member_name,position")
        .in("party_id", partyIds)
        .order("position", { ascending: true })
        .order("member_name", { ascending: true });

      // Enrich with class
      const discordIds = (members ?? []).map((m) => m.discord_user_id).filter(Boolean);
      let classMap: Record<string, { class_name: string; class_icon: string }> = {};
      if (discordIds.length > 0) {
        const { data: mRows } = await supabaseAdmin
          .from("member")
          .select("discord_user_id,class:class!member_class_id_fkey(name,icon_url)")
          .in("discord_user_id", discordIds);
        for (const m of mRows ?? []) {
          if (!m.discord_user_id) continue;
          const cls = Array.isArray(m.class) ? m.class[0] : (m.class as any);
          classMap[m.discord_user_id] = { class_name: cls?.name ?? "", class_icon: cls?.icon_url ?? "" };
        }
      }

      for (const m of members ?? []) {
        if (!memberMap[m.party_id]) memberMap[m.party_id] = [];
        memberMap[m.party_id].push({
          discord_user_id: m.discord_user_id,
          member_name: m.member_name ?? "",
          position: typeof m.position === "number" ? m.position : 999999,
          ...(classMap[m.discord_user_id] ?? { class_name: "", class_icon: "" }),
        });
      }
    }

    const items = (parties ?? []).map((p) => ({ ...p, members: memberMap[p.id] ?? [] }));
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id: eventId } = await params;
    const body = await req.json().catch(() => ({}));
    const name  = String(body?.name  ?? "").trim();
    const color = String(body?.color ?? "#6366f1").trim();

    if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("event_parties")
      .insert({ event_id: eventId, name, color })
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
