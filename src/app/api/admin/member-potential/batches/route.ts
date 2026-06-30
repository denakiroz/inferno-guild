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

    // Use embedded count so Supabase does COUNT(*) at DB level
    const { data, error } = await supabaseAdmin
      .from("member_potential_batches")
      .select("id,label,battle_date,imported_at,imported_by,opponent_guild,guild,member_potential_records(count)")
      .order("battle_date", { ascending: false, nullsFirst: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const items = (data ?? []).map((b: any) => ({
      id: b.id,
      label: b.label,
      battle_date: b.battle_date ?? null,
      imported_at: b.imported_at,
      imported_by: b.imported_by,
      opponent_guild: b.opponent_guild,
      guild: b.guild,
      record_count: (b.member_potential_records as { count: number }[])?.[0]?.count ?? 0,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
