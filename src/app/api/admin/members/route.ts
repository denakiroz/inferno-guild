// src/app/api/admin/members/route.ts
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
  discord_user_id,
  status,
  class:class!member_class_id_fkey(
    id,
    name,
    icon_url
  )
`;

export async function GET() {
  // Next 16 บาง setup cookies() เป็น async → ใช้ await ให้ชัวร์
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;

  if (!sid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession(sid);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: members, error: memErr } = await supabaseAdmin
    .from("member")
    .select(SELECT_MEMBER_WITH_CLASS)
    .order("id", { ascending: true });

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const { data: leaves, error: leaveErr } = await supabaseAdmin
    .from("leave")
    .select("id,date_time,member_id,reason")
    .order("date_time", { ascending: false });

  if (leaveErr) {
    // leaves พังไม่ควรทำให้ทั้งหน้าพัง
    return NextResponse.json(
      { members: members ?? [], leaves: [] },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { members: members ?? [], leaves: leaves ?? [] },
    { status: 200 }
  );
}
