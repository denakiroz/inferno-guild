// src/app/api/admin/club-party-plans-2/route.ts
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

export async function GET(req: Request) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10")));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabaseAdmin
      .from("club_party_plan_2")
      .select("id,created_at,our_name,opponent_name,match_date,parties,note", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      items: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const our_name = String(body?.our_name ?? "Inferno").trim() || "Inferno";
    const opponent_name = String(body?.opponent_name ?? "").trim();
    const match_date_raw = String(body?.match_date ?? "").trim();
    const match_time_raw = String(body?.match_time ?? "").trim();
    const parties = body?.parties;

    if (!opponent_name) return NextResponse.json({ ok: false, error: "opponent_name required" }, { status: 400 });
    if (!match_date_raw) return NextResponse.json({ ok: false, error: "match_date required" }, { status: 400 });
    if (!Array.isArray(parties)) return NextResponse.json({ ok: false, error: "parties must be array" }, { status: 400 });

    // combine date + time → ISO timestamp (e.g. "2026-04-09T21:30:00")
    const match_date = match_time_raw
      ? `${match_date_raw}T${match_time_raw}:00`
      : `${match_date_raw}T00:00:00`;

    const created_by = (session as any)?.userId ?? (session as any)?.user?.id ?? null;

    const { data, error } = await supabaseAdmin
      .from("club_party_plan_2")
      .insert({
        our_name,
        opponent_name,
        match_date,
        parties,
        created_by,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
