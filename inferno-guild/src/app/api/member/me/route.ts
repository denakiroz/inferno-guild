import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { supabase } from "../../../../lib/supabase/client"; // ให้ import ตามไฟล์คุณ
// ถ้าคุณ export default/ชื่อไม่ตรง ส่งไฟล์ supabaseClient.ts มาตรงนี้ เดี๋ยวผมปรับ path ให้เป๊ะ

export const runtime = "nodejs";

function getSid(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  return cookie.match(/(?:^|;\s*)sid=([^;]+)/)?.[1] ?? null;
}

export async function GET(req: Request) {
  const sid = getSid(req);
  if (!sid) return NextResponse.json({ ok: false }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const discord_user_id = BigInt(session.discordUserId); // ใน DB เป็น int8
  const guild = session.guild;

  // 1) read
  const { data, error } = await supabase
    .from("member")
    .select("*")
    .eq("discord_user_id", discord_user_id.toString())
    .eq("guild", guild)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // 2) if not exists => create placeholder
  if (!data) {
    const payload = {
      discord_user_id: discord_user_id.toString(),
      name: session.displayName,
      class: "",
      power: 0,
      party: null,
      party_2: null,
      pos_party: null,
      pos_party_2: null,
      color: "",
      is_special: false,
      guild,
    };

    const ins = await supabase.from("member").insert(payload).select("*").single();
    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });

    return NextResponse.json({ ok: true, member: ins.data });
  }

  return NextResponse.json({ ok: true, member: data });
}

export async function PUT(req: Request) {
  const sid = getSid(req);
  if (!sid) return NextResponse.json({ ok: false }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const discord_user_id = BigInt(session.discordUserId).toString();
  const guild = session.guild;

  // allowlist fields (กัน user แอบส่ง guild มาเปลี่ยนเอง)
  const patch: any = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.class === "string") patch.class = body.class;
  if (typeof body.power === "number") patch.power = Math.max(0, Math.floor(body.power));
  if (typeof body.color === "string") patch.color = body.color;
  if (typeof body.is_special === "boolean") patch.is_special = body.is_special;

  const { data, error } = await supabase
    .from("member")
    .update(patch)
    .eq("discord_user_id", discord_user_id)
    .eq("guild", guild)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, member: data });
}
