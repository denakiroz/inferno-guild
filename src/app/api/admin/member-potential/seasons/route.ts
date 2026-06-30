// GET  → รายการ seasons ทั้งหมด (เรียงตาม start_date desc)
// POST → สร้าง season ใหม่
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
      .from("member_potential_seasons")
      .select("id,name,start_date,end_date,created_at")
      .order("start_date", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const name       = String(body?.name ?? "").trim();
    const start_date = String(body?.start_date ?? "").trim();
    const end_date   = String(body?.end_date   ?? "").trim();

    if (!name)       return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    if (!start_date) return NextResponse.json({ ok: false, error: "start_date is required" }, { status: 400 });
    if (!end_date)   return NextResponse.json({ ok: false, error: "end_date is required" }, { status: 400 });
    if (end_date < start_date)
      return NextResponse.json({ ok: false, error: "end_date must be >= start_date" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("member_potential_seasons")
      .insert({ name, start_date, end_date })
      .select("id,name,start_date,end_date,created_at")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
