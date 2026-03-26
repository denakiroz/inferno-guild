// src/app/api/admin/members/set-club2/route.ts
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

/**
 * POST /api/admin/members/set-club2
 * Body: { memberId: number, club_2: boolean }
 *    OR { memberIds: number[], club_2: boolean }   (bulk)
 */
export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const club2Val = !!body.club_2;

    // bulk
    if (Array.isArray(body.memberIds)) {
      const ids = (body.memberIds as any[])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (ids.length === 0) return NextResponse.json({ ok: true, updated: 0 });

      const { error } = await supabaseAdmin
        .from("member")
        .update({ club_2: club2Val })
        .in("id", ids);

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      return NextResponse.json({ ok: true, updated: ids.length });
    }

    // single
    const memberId = Number(body.memberId);
    if (!Number.isFinite(memberId) || memberId <= 0)
      return NextResponse.json({ ok: false, error: "invalid_memberId" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("member")
      .update({ club_2: club2Val })
      .eq("id", memberId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updated: 1 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
