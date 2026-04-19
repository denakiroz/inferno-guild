// GET  → leaderboard (averages + scores per player)
// POST → import batch (create batch + insert records)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildLeaderboard, type LeaderboardItem } from "@/lib/memberPotential";
import { cacheGetOrSet, CK, invalidateMemberPotential } from "@/lib/redisCache";

export const runtime = "nodejs";

const LEADERBOARD_TTL = 300; // 5 นาที

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

    // Redis cache (TTL 5 นาที) — invalidate เมื่อ POST/PATCH/DELETE batches/records/weights
    const items = await cacheGetOrSet<LeaderboardItem[] | null>(
      CK.leaderboard(),
      LEADERBOARD_TTL,
      async () => {
        const result = await buildLeaderboard();
        if (!result.ok) throw new Error(result.error);
        return result.items;
      }
    );
    if (!items) return NextResponse.json({ ok: false, error: "no data" }, { status: 500 });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const label = String(body?.label ?? "").trim() || new Date().toLocaleDateString("th-TH");
    const opponent_guild = body?.opponent_guild ? String(body.opponent_guild).trim() || null : null;
    const guild = body?.guild != null ? Number(body.guild) : null;
    const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0)
      return NextResponse.json({ ok: false, error: "rows is empty" }, { status: 400 });

    const imported_by = (session as any)?.userId ?? (session as any)?.user?.id ?? null;

    // Create batch
    const { data: batch, error: bErr } = await supabaseAdmin
      .from("member_potential_batches")
      .insert({ label, imported_by, opponent_guild, guild })
      .select("id")
      .single();
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

    // Snapshot class_id ณ เวลา import — กัน class เปลี่ยนทีหลัง
    const discordIds = rows
      .map((r) => String(r.userdiscordid ?? "").trim())
      .filter(Boolean);

    const { data: memberRows } = await supabaseAdmin
      .from("member")
      .select("discord_user_id, class_id")
      .in("discord_user_id", discordIds);

    const classMap = new Map<string, number | null>();
    for (const m of memberRows ?? []) {
      if (m.discord_user_id)
        classMap.set(String(m.discord_user_id), m.class_id ? Number(m.class_id) : null);
    }

    // Insert records
    const records = rows
      .filter((r) => String(r.userdiscordid ?? "").trim())
      .map((r) => {
        const uid = String(r.userdiscordid ?? "").trim();
        return {
          batch_id: batch.id,
          userdiscordid: uid,
          discordname: String(r.discordname ?? "").trim(),
          class_id: classMap.get(uid) ?? null,   // snapshot อาชีพ ณ เวลานี้
          kill: Number(r.kill) || 0,
          assist: Number(r.assist) || 0,
          supply: Number(r.supply) || 0,
          damage_player: Number(r.damage_player) || 0,
          damage_fort: Number(r.damage_fort) || 0,
          heal: Number(r.heal) || 0,
          damage_taken: Number(r.damage_taken) || 0,
          death: Number(r.death) || 0,
          revive: Number(r.revive) || 0,
        };
      });

    const { error: rErr } = await supabaseAdmin
      .from("member_potential_records")
      .insert(records);
    if (rErr) {
      // rollback batch
      await supabaseAdmin.from("member_potential_batches").delete().eq("id", batch.id);
      return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    }

    // ลบ leaderboard cache — batch ใหม่ทำให้ค่าเปลี่ยน
    await invalidateMemberPotential();

    return NextResponse.json({ ok: true, batch_id: batch.id, count: records.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
