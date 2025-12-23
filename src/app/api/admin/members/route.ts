// src/app/api/admin/members/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Keep shape compatible with old response.
 * - Return members with class join
 * - Do NOT return inactive members
 * - Allow optional guild filter via query param (?guild=1)
 */
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
  special_text,
  remark,
  update_date,
  class:class!member_class_id_fkey(
    id,
    name,
    icon_url
  )
`;

function normalizeStatusForFilter(status: unknown): string {
  if (status === null || status === undefined) return "active";
  return String(status).toLowerCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guild = url.searchParams.get("guild"); // optional

  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;

  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin && !session.isHead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let q = supabaseAdmin.from("member").select(SELECT_MEMBER_WITH_CLASS).order("id", { ascending: true });

  if (guild) q = q.eq("guild", Number(guild));

  const { data: rawMembers, error: memErr } = await q;

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const members = (rawMembers ?? []).filter((m: any) => normalizeStatusForFilter(m?.status) !== "inactive");

  const { data: leaves, error: leaveErr } = await supabaseAdmin
    .from("leave")
    // ✅ ดึง status + update_date มาด้วย (สำคัญ)
    .select("id,date_time,member_id,reason,status,update_date")
    .order("date_time", { ascending: false });

  if (leaveErr) {
    return NextResponse.json({ members, leaves: [] }, { status: 200 });
  }

  return NextResponse.json({ members, leaves: leaves ?? [] }, { status: 200 });
}
