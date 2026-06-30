// PATCH -> แก้ไข season (name, start_date, end_date)
// DELETE -> ลบ season
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { invalidateMemberPotential } from "@/lib/redisCache";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const patch: Record<string, string> = {};
    if (body?.name       != null) patch.name       = String(body.name).trim();
    if (body?.start_date != null) patch.start_date = String(body.start_date).trim();
    if (body?.end_date   != null) patch.end_date   = String(body.end_date).trim();

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });

    if (patch.start_date && patch.end_date && patch.end_date < patch.start_date)
      return NextResponse.json({ ok: false, error: "end_date must be >= start_date" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("member_potential_seasons")
      .update(patch)
      .eq("id", Number(id));

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Season dates changed -> leaderboard cache for this season is stale
    await invalidateMemberPotential();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("member_potential_seasons")
      .delete()
      .eq("id", Number(id));

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Season deleted -> clear all leaderboard cache
    await invalidateMemberPotential();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
