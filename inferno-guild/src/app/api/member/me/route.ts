import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  return session ?? null;
}

async function getMyMember(discordUserId: string, guild: number) {
  // discord_user_id เป็น int8 ใน supabase => ส่งเป็น string ได้
  const discord_user_id = BigInt(discordUserId).toString();

  const { data, error } = await supabaseAdmin
    .from("member")
    .select("id, discord_user_id, name, power, is_special, guild, class_id")
    .eq("discord_user_id", discord_user_id)
    .eq("guild", guild)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as
    | {
        id: number;
        discord_user_id: string;
        name: string;
        power: number;
        is_special: boolean;
        guild: number;
        class_id: number | null;
      }
    | null;
}

/** (optional) map class name -> class_id เพื่อรองรับ client เก่าที่ส่ง "class" มาเป็น string */
async function resolveClassIdFromName(className: string) {
  const name = String(className ?? "").trim();
  if (!name) return 0;

  const { data, error } = await supabaseAdmin.from("class").select("id").eq("name", name).maybeSingle();
  if (error) throw new Error(error.message);

  return Number(data?.id ?? 0) || 0;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const guild = session.guild;
    const discord_user_id = BigInt(session.discordUserId).toString();

    // 1) read
    const exist = await getMyMember(session.discordUserId, guild);

    // 2) if not exists => create placeholder (ใช้ class_id ไม่ใช้ class)
    if (!exist) {
      const payload = {
        discord_user_id,
        name: session.displayName ?? "Member",
        power: 0,
        is_special: false,
        guild,
        class_id: 0,
      };

      const ins = await supabaseAdmin.from("member").insert(payload).select("id, discord_user_id, name, power, is_special, guild, class_id").single();
      if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });

      return NextResponse.json({ ok: true, member: ins.data });
    }

    return NextResponse.json({ ok: true, member: exist });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const guild = session.guild;
    const discord_user_id = BigInt(session.discordUserId).toString();

    // ✅ allowlist เฉพาะฟิลด์ที่มีจริงใน table member
    const patch: Record<string, any> = {};

    // ถ้าคุณ disable ชื่อใน UI ก็จะไม่ส่งมาก็ได้ แต่เผื่อไว้
    if (typeof body.name === "string") patch.name = body.name.trim();

    if (typeof body.power === "number") patch.power = Math.max(0, Math.floor(body.power));
    if (typeof body.is_special === "boolean") patch.is_special = body.is_special;

    // ✅ class_id preferred
    if (typeof body.class_id === "number") {
      patch.class_id = Number(body.class_id) || 0;
    } else if (typeof body.class_id === "string") {
      patch.class_id = Number(body.class_id) || 0;
    } else if (typeof body.class === "string") {
      // ✅ backward-compatible: client เก่าส่ง class เป็นชื่ออาชีพ
      patch.class_id = await resolveClassIdFromName(body.class);
    }

    // กันเคสส่งมาเปล่าๆ
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("member")
      .update(patch)
      .eq("discord_user_id", discord_user_id)
      .eq("guild", guild)
      .select("id, discord_user_id, name, power, is_special, guild, class_id")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, member: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
