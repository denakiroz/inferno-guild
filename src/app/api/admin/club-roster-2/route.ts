// src/app/api/admin/club-roster-2/route.ts
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
  if (!session) return null;

  if (!(session.isAdmin || session.isHead)) return null;

  return session;
}

export async function GET() {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("member")
      .select("id,name,power,class_id,guild,is_special,status,color,club_2,update_date")
      .eq("club_2", true)
      .order("power", { ascending: false })
      .order("id", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const members = (data ?? []) as any[];
    const ids = members.map((m) => Number(m.id)).filter((n) => Number.isFinite(n) && n > 0);

    // fetch ultimate mapping
    let ultimateByMember = new Map<number, number[]>();
    if (ids.length > 0) {
      const { data: mu, error: muErr } = await supabaseAdmin
        .from("member_ultimate_skill")
        .select("member_id, ultimate_skill_id")
        .in("member_id", ids);

      if (!muErr) {
        for (const r of (mu ?? []) as any[]) {
          const mid = Number(r.member_id);
          const uid = Number(r.ultimate_skill_id);
          if (!Number.isFinite(mid) || !Number.isFinite(uid)) continue;
          const arr = ultimateByMember.get(mid) ?? [];
          arr.push(uid);
          ultimateByMember.set(mid, arr);
        }
      }
    }

    // fetch special skill mapping
    let specialByMember = new Map<number, number[]>();
    if (ids.length > 0) {
      const { data: ms } = await supabaseAdmin
        .from("member_special_skill")
        .select("member_id, special_skill_id")
        .in("member_id", ids);

      for (const r of (ms ?? []) as any[]) {
        const mid = Number(r.member_id);
        const sid = Number(r.special_skill_id);
        if (!Number.isFinite(mid) || !Number.isFinite(sid)) continue;
        const arr = specialByMember.get(mid) ?? [];
        arr.push(sid);
        specialByMember.set(mid, arr);
      }
    }

    const enriched = members.map((m) => ({
      ...m,
      ultimate_skill_ids: ultimateByMember.get(Number(m.id)) ?? [],
      special_skill_ids:  specialByMember.get(Number(m.id))  ?? [],
    }));

    return NextResponse.json({ ok: true, members: enriched });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
