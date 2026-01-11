import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type EquipmentType = 1 | 2 | 3 | 4;

function toEquipmentType(v: any): EquipmentType | null {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  if (!session?.isAdmin) return null;

  return session;
}

// GET /api/admin/skill-stones
// -> { ok:true, skill_stones:[{id,name,image_url,type}] }
export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("equipment_create")
      .select("id, name, image_url, type")
      .in("type", [1, 2, 3, 4])
      .order("type", { ascending: true })
      .order("id", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, skill_stones: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}

// POST /api/admin/skill-stones
// body: { name, image_url?, type }
export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();
    const image_url = body?.image_url == null ? null : String(body.image_url).trim() || null;
    const type = toEquipmentType(body?.type);

    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    if (!type) return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });

    const { error } = await supabaseAdmin.from("equipment_create").insert([{ name, image_url, type }]);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}

// PUT /api/admin/skill-stones
// body: { id, name, image_url?, type }
export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => null);
    const id = Number(body?.id);
    const name = String(body?.name ?? "").trim();
    const image_url = body?.image_url == null ? null : String(body.image_url).trim() || null;
    const type = toEquipmentType(body?.type);

    if (!Number.isFinite(id) || id <= 0)
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    if (!type) return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("equipment_create")
      .update({ name, image_url, type })
      .eq("id", id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown_error" }, { status: 500 });
  }
}
