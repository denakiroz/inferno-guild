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
      .from("ultimate_skill")
      .select("id, name, ultimate_skill_url")
      .order("id", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, skills: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireStaff();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const name = String(body.name ?? "").trim();
    const ultimate_skill_url = String(body.ultimate_skill_url ?? "").trim();

    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("ultimate_skill")
      .insert({ name, ultimate_skill_url })
      .select("id, name, ultimate_skill_url")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireStaff();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const patch: Record<string, any> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.ultimate_skill_url === "string") patch.ultimate_skill_url = body.ultimate_skill_url.trim();

    if (!patch.name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("ultimate_skill")
      .update(patch)
      .eq("id", id)
      .select("id, name, ultimate_skill_url")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
