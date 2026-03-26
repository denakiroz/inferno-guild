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

async function getMyMemberId(discordUserId: string, guild: number): Promise<number> {
  const discord_user_id = BigInt(discordUserId).toString();

  const { data, error } = await supabaseAdmin
    .from("member")
    .select("id")
    .eq("discord_user_id", discord_user_id)
    .eq("guild", guild)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = (data as { id: number } | null) ?? null;
  if (!row?.id) throw new Error("member_not_found");

  return Number(row.id);
}

// GET: return all special_skill master + my selected ids
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId, session.guild);

    const { data: masterData, error: masterErr } = await supabaseAdmin
      .from("special_skill")
      .select("id, name, special_skill_url")
      .order("id", { ascending: true });

    if (masterErr)
      return NextResponse.json({ ok: false, error: masterErr.message }, { status: 500 });

    const { data: linkData, error: linkErr } = await supabaseAdmin
      .from("member_special_skill")
      .select("special_skill_id")
      .eq("member_id", memberId)
      .order("special_skill_id", { ascending: true });

    if (linkErr)
      return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 });

    const selectedIds = ((Array.isArray(linkData) ? linkData : []) as Array<{ special_skill_id: number }>)
      .map((r) => Number(r.special_skill_id))
      .filter((n) => Number.isFinite(n) && n > 0);

    return NextResponse.json({
      ok: true,
      skills: masterData ?? [],
      selected_ids: selectedIds,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

// PUT: replace member's special_skill selection with the given ids
export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const body = (await req.json().catch(() => null)) as any;
    if (!body || typeof body !== "object")
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const rawIds: unknown = body.special_skill_ids;
    if (!Array.isArray(rawIds))
      return NextResponse.json({ ok: false, error: "special_skill_ids_required" }, { status: 400 });

    const desiredIds = rawIds
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);

    const uniqueIds = Array.from(new Set(desiredIds)).sort((a, b) => a - b);

    const memberId = await getMyMemberId(session.discordUserId, session.guild);

    // validate all ids exist
    if (uniqueIds.length > 0) {
      const { data: check, error: checkErr } = await supabaseAdmin
        .from("special_skill")
        .select("id")
        .in("id", uniqueIds);

      if (checkErr)
        return NextResponse.json({ ok: false, error: checkErr.message }, { status: 500 });

      const existing = new Set(
        ((Array.isArray(check) ? check : []) as Array<{ id: number }>).map((r) => Number(r.id))
      );

      for (const id of uniqueIds) {
        if (!existing.has(id))
          return NextResponse.json(
            { ok: false, error: `special_skill_not_found: ${id}` },
            { status: 400 }
          );
      }
    }

    // delete all existing links for this member
    const { error: delErr } = await supabaseAdmin
      .from("member_special_skill")
      .delete()
      .eq("member_id", memberId);

    if (delErr)
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

    // insert desired
    if (uniqueIds.length > 0) {
      const inserts = uniqueIds.map((special_skill_id) => ({ member_id: memberId, special_skill_id }));
      const { error: insErr } = await supabaseAdmin.from("member_special_skill").insert(inserts);
      if (insErr)
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, selected_ids: uniqueIds });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
