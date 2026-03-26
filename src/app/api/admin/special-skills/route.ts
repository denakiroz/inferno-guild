import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await getSession(sid);
  if (!session?.isAdmin) return null;
  return session;
}

async function requireStaff() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await getSession(sid);
  if (!session?.isAdmin && !session?.isHead) return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireStaff();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("special_skill")
      .select("id, name, special_skill_url, created_at")
      .order("id", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, skills: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const name = String(body.name ?? "").trim();
    const special_skill_url = String(body.special_skill_url ?? "").trim() || null;

    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("special_skill")
      .insert({ name, special_skill_url })
      .select("id, name, special_skill_url, created_at")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0)
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const patch: Record<string, any> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if ("special_skill_url" in body)
      patch.special_skill_url = String(body.special_skill_url ?? "").trim() || null;

    if (!patch.name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("special_skill")
      .update(patch)
      .eq("id", id)
      .select("id, name, special_skill_url, created_at")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0)
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const { error } = await supabaseAdmin.from("special_skill").delete().eq("id", id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
