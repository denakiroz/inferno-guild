// src/app/api/club/members/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const SELECT_MEMBER_WITH_CLASS = `
  id,
  name,
  class_id,
  power,
  party,
  party_2,
  pos_party,
  pos_party_2,
  color,
  is_special,
  guild,
  club,
  discord_user_id,
  status,
  update_date,
  class:class!member_class_id_fkey(
    id,
    name,
    icon_url
  )
`;

const SELECT_LEAVE = `
  id,
  date_time,
  member_id,
  reason,
  status,
  update_date
`;

async function requireSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await getSession(sid);
  return session ?? null;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: members, error: memErr } = await supabaseAdmin
      .from("member")
      .select(SELECT_MEMBER_WITH_CLASS)
      .eq("club", true)
      .order("power", { ascending: false })
      .order("id", { ascending: true });

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });

    const ids = (members ?? []).map((m: any) => m.id).filter(Boolean);

    const { data: leaves, error: leaveErr } = await supabaseAdmin
      .from("leave")
      .select(SELECT_LEAVE)
      .in("member_id", ids.length ? ids : [0])
      .order("date_time", { ascending: false });

    const safeLeaves = leaveErr ? [] : (leaves ?? []);

    return NextResponse.json({ ok: true, members: members ?? [], leaves: safeLeaves }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
