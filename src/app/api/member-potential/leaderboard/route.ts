// GET /api/member-potential/leaderboard
// Public endpoint (requires login only) — returns ranked leaderboard
// ?season_id=<id> → กรองตาม season, ไม่ระบุ = current season (ตาม date), null = all-time
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { buildLeaderboard } from "@/lib/memberPotential";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function resolvePublicSeason(seasonId: string | null) {
  if (seasonId === "all") return undefined; // all-time explicit

  if (seasonId) {
    // season_id ระบุตรง
    const { data } = await supabaseAdmin
      .from("member_potential_seasons")
      .select("start_date,end_date")
      .eq("id", Number(seasonId))
      .single();
    if (data) return { fromDate: data.start_date as string, toDate: data.end_date as string };
    return undefined;
  }

  // ไม่ระบุ → หา current season จากวันที่วันนี้
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("member_potential_seasons")
    .select("start_date,end_date")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) return { fromDate: data.start_date as string, toDate: data.end_date as string };
  return undefined; // ไม่มี season ที่ active → all-time
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
    if (!sid) return NextResponse.json({ ok: false }, { status: 401 });
    const session = await getSession(sid);
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get("season_id");
    const season = await resolvePublicSeason(seasonId);

    const result = await buildLeaderboard(season);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });

    // Assign rank per role group, expose public fields
    const roleRanks: Record<string, number> = {};
    const ranked = result.items.map((r) => {
      roleRanks[r.role] = (roleRanks[r.role] ?? 0) + 1;
      return {
        rank: roleRanks[r.role],
        userdiscordid: r.userdiscordid,
        name: r.discordname,
        class_name: r.class_name,
        class_icon: r.class_icon,
        guild: r.guild,
        score: r.score,
        role: r.role,
        avgs: r.avgs, // per-category averages สำหรับ radar chart เทียบค่าเฉลี่ยทีม
      };
    });

    return NextResponse.json({ ok: true, items: ranked });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
