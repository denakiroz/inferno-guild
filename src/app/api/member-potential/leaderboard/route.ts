// GET /api/member-potential/leaderboard
// Public endpoint (requires login only) — returns ranked leaderboard
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { buildLeaderboard } from "@/lib/memberPotential";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
    if (!sid) return NextResponse.json({ ok: false }, { status: 401 });
    const session = await getSession(sid);
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const result = await buildLeaderboard();
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
      };
    });

    return NextResponse.json({ ok: true, items: ranked });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
