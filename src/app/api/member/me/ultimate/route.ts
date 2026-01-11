// app/api/member/me/ultimate/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type MemberIdRow = { id: number };
type MemberUltimateRow = { ultimate_skill_id: number };

async function requireSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  return session ?? null;
}

async function getMyMemberId(discordUserId: string, guild: number): Promise<number> {
  const discord_user_id = BigInt(discordUserId).toString();

  const { data, error } = await supabaseAdmin
    .from("member")
    .select("id")
    .eq("discord_user_id", discord_user_id)
    .eq("guild", guild)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = (data as MemberIdRow | null) ?? null;
  if (!row?.id) throw new Error("member_not_found");

  return Number(row.id);
}

function normalizeIds(input: unknown): number[] {
  const raw = Array.isArray(input) ? input : [];
  const ids = raw
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId, session.guild);

    const { data, error } = await supabaseAdmin
      .from("member_ultimate_skill")
      .select("ultimate_skill_id")
      .eq("member_id", memberId)
      .order("ultimate_skill_id", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (Array.isArray(data) ? data : []) as MemberUltimateRow[];

    const ids = rows
      .map((r) => Number(r.ultimate_skill_id))
      .filter((x) => Number.isFinite(x) && x > 0);

    return NextResponse.json({ ok: true, ultimate_skill_ids: ids });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const memberId = await getMyMemberId(session.discordUserId, session.guild);
    const nextIds = normalizeIds((body as any).ultimate_skill_ids);

    const { data: existingData, error: loadErr } = await supabaseAdmin
      .from("member_ultimate_skill")
      .select("ultimate_skill_id")
      .eq("member_id", memberId);

    if (loadErr) return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });

    const existingRows = (Array.isArray(existingData) ? existingData : []) as MemberUltimateRow[];

    const existingIds = new Set<number>(
      existingRows
        .map((r) => Number(r.ultimate_skill_id))
        .filter((x) => Number.isFinite(x) && x > 0)
    );

    const nextSet = new Set<number>(nextIds);
    const toDelete = Array.from(existingIds).filter((id) => !nextSet.has(id));
    const toInsert = nextIds.filter((id) => !existingIds.has(id));

    if (toDelete.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("member_ultimate_skill")
        .delete()
        .eq("member_id", memberId)
        .in("ultimate_skill_id", toDelete);

      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    if (toInsert.length > 0) {
      const payload: Array<{ member_id: number; ultimate_skill_id: number }> = toInsert.map((ultimate_skill_id) => ({
        member_id: memberId,
        ultimate_skill_id,
      }));

      const { error: insErr } = await supabaseAdmin.from("member_ultimate_skill").insert(payload);
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ultimate_skill_ids: nextIds });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
