// GET    /api/admin/events/[id]/registrations  — list registrations
// DELETE /api/admin/events/[id]/registrations  — remove a registration (body: {discord_user_id})
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

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("event_registrations")
      .select("id,discord_user_id,member_name,registered_at")
      .eq("event_id", id)
      .order("registered_at", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Enrich with member class info
    const discordIds = (data ?? []).map((r) => r.discord_user_id).filter(Boolean);
    let classMap: Record<string, { class_name: string; class_icon: string }> = {};
    if (discordIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from("member")
        .select("discord_user_id,class:class!member_class_id_fkey(name,icon_url)")
        .in("discord_user_id", discordIds);
      for (const m of members ?? []) {
        if (!m.discord_user_id) continue;
        const cls = Array.isArray(m.class) ? m.class[0] : (m.class as any);
        classMap[m.discord_user_id] = {
          class_name: cls?.name ?? "",
          class_icon: cls?.icon_url ?? "",
        };
      }
    }

    const items = (data ?? []).map((r) => ({
      ...r,
      ...(classMap[r.discord_user_id] ?? { class_name: "", class_icon: "" }),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const discordUserId = String(body?.discord_user_id ?? "").trim();

    if (!discordUserId)
      return NextResponse.json({ ok: false, error: "discord_user_id required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("event_registrations")
      .delete()
      .eq("event_id", id)
      .eq("discord_user_id", discordUserId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
