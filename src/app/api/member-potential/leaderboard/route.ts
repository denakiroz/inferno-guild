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

    // Assign rank and expose only public fields (no avgs detail)
    const ranked = result.items.map((r, i) => ({
      rank: i + 1,
      userdiscordid: r.userdiscordid,
      name: r.discordname,
      class_name: r.class_name,
      class_icon: r.class_icon,
      guild: r.guild,
      score: r.score,
    }));

    return NextResponse.json({ ok: true, items: ranked });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
