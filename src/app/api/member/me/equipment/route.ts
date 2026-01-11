// app/api/member/me/equipment/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ELEMENT_KEYS = ["gold", "wood", "water", "fire", "earth"] as const;
type ElementKey = (typeof ELEMENT_KEYS)[number];

type ElementLevels = Record<ElementKey, number>;

function toInt(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.floor(x);
}

function sumLevels(levels: ElementLevels): number {
  return (
    (Number(levels.gold) || 0) +
    (Number(levels.wood) || 0) +
    (Number(levels.water) || 0) +
    (Number(levels.fire) || 0) +
    (Number(levels.earth) || 0)
  );
}

function validateElement(raw: any): { ok: true; value: ElementLevels } | { ok: false; error: string } {
  const obj = typeof raw === "object" && raw ? raw : {};
  const next: ElementLevels = {
    gold: toInt((obj as any).gold),
    wood: toInt((obj as any).wood),
    water: toInt((obj as any).water),
    fire: toInt((obj as any).fire),
    earth: toInt((obj as any).earth),
  };

  for (const k of ELEMENT_KEYS) {
    if (next[k] < 0 || next[k] > 3) return { ok: false, error: "element_level_out_of_range" };
  }

  if (sumLevels(next) > 7) return { ok: false, error: "sum_level_exceed_7" };

  return { ok: true, value: next };
}

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
    .select("id, discord_user_id, guild")
    .eq("discord_user_id", discord_user_id)
    .eq("guild", guild)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { id: number; discord_user_id: string; guild: number } | null;
}

async function ensureMember(session: any) {
  const guild = session.guild as number;
  const discord_user_id = BigInt(session.discordUserId).toString();

  const exist = await getMyMember(session.discordUserId, guild);
  if (exist) return exist;

  // create placeholder member (เหมือน /member/me)
  const payload = {
    discord_user_id,
    name: session.displayName ?? "Member",
    power: 0,
    is_special: false,
    guild,
    class_id: 0,
  };

  const ins = await supabaseAdmin
    .from("member")
    .insert(payload)
    .select("id, discord_user_id, guild")
    .single();

  if (ins.error) throw new Error(ins.error.message);
  return ins.data as { id: number; discord_user_id: string; guild: number };
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const me = await ensureMember(session);

    const { data, error } = await supabaseAdmin
      .from("member_equipment")
      .select("id, member_id, element, image, created_at")
      .eq("member_id", me.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, sets: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const me = await ensureMember(session);

    // max 2 sets per member
    const exist = await supabaseAdmin.from("member_equipment").select("id").eq("member_id", me.id);
    if (exist.error) return NextResponse.json({ ok: false, error: exist.error.message }, { status: 500 });

    if ((exist.data?.length ?? 0) >= 2) {
      return NextResponse.json({ ok: false, error: "max_2_sets" }, { status: 400 });
    }

    const v = validateElement(body.element);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

    const image = typeof body.image === "string" ? body.image.trim() : null;

    const { data, error } = await supabaseAdmin
      .from("member_equipment")
      .insert({
        member_id: me.id,
        element: v.value,
        image: image || null,
      })
      .select("id, member_id, element, image, created_at")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, set: data });
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

    const me = await ensureMember(session);

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const patch: Record<string, any> = {};

    if (body.element !== undefined) {
      const v = validateElement(body.element);
      if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
      patch.element = v.value;
    }

    if (body.image !== undefined) {
      const image = typeof body.image === "string" ? body.image.trim() : "";
      patch.image = image ? image : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("member_equipment")
      .update(patch)
      .eq("id", id)
      .eq("member_id", me.id)
      .select("id, member_id, element, image, created_at")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, set: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const me = await ensureMember(session);

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("member_equipment")
      .delete()
      .eq("id", id)
      .eq("member_id", me.id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
