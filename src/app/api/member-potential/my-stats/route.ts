// GET /api/member-potential/my-stats
// Returns current user's last 3 batches with per-batch stats + score
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CATEGORIES, type Category } from "@/lib/memberPotential";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
    if (!sid) return NextResponse.json({ ok: false }, { status: 401 });

    const session = await getSession(sid);
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    // Get current user's discord_user_id from member table
    const discordUserId = session.discordUserId ?? null;
    if (!discordUserId) return NextResponse.json({ ok: false, error: "no discord id" }, { status: 400 });

    // Get member info (class_id)
    const { data: memberRow } = await supabaseAdmin
      .from("member")
      .select("class_id")
      .eq("discord_user_id", discordUserId)
      .single();

    const classId = memberRow?.class_id ? Number(memberRow.class_id) : null;

    // Get last 3 batches that contain this user's records
    const { data: records, error: recErr } = await supabaseAdmin
      .from("member_potential_records")
      .select(`
        batch_id,
        kill, assist, supply, damage_player, damage_fort,
        heal, damage_taken, death, revive,
        batch:member_potential_batches!member_potential_records_batch_id_fkey(
          id, label, imported_at, opponent_guild
        )
      `)
      .eq("userdiscordid", discordUserId)
      .order("batch_id", { ascending: false });

    if (recErr) return NextResponse.json({ ok: false, error: recErr.message }, { status: 500 });

    // Group by batch (aggregate in case of multiple records per batch)
    type BatchStats = Record<Category, { sum: number; count: number }>;
    const batchMap = new Map<string, {
      label: string;
      imported_at: string;
      opponent_guild: string | null;
      stats: BatchStats;
    }>();

    for (const r of records ?? []) {
      const bid = String(r.batch_id);
      const batchInfo = Array.isArray(r.batch) ? r.batch[0] : (r.batch as any);
      if (!batchMap.has(bid)) {
        batchMap.set(bid, {
          label: batchInfo?.label ?? bid,
          imported_at: batchInfo?.imported_at ?? "",
          opponent_guild: batchInfo?.opponent_guild ?? null,
          stats: Object.fromEntries(CATEGORIES.map((c) => [c, { sum: 0, count: 0 }])) as BatchStats,
        });
      }
      const entry = batchMap.get(bid)!;
      for (const c of CATEGORIES) {
        entry.stats[c].sum += Number((r as any)[c] ?? 0);
        entry.stats[c].count += 1;
      }
    }

    // Get weights for score calculation
    const { data: weights } = await supabaseAdmin
      .from("member_potential_weights")
      .select("class_id,category,weight,enabled");

    type WeightMap = Map<Category, number>;
    const defaultWeights: WeightMap = new Map();
    const classWeights: Map<number, WeightMap> = new Map();

    for (const w of weights ?? []) {
      if (!w.enabled) continue;
      const cat = w.category as Category;
      const val = Number(w.weight);
      if (w.class_id == null) {
        defaultWeights.set(cat, val);
      } else {
        const cid = Number(w.class_id);
        if (!classWeights.has(cid)) classWeights.set(cid, new Map());
        classWeights.get(cid)!.set(cat, val);
      }
    }

    const getWeight = (cid: number | null, cat: Category): number => {
      if (cid != null) {
        const ov = classWeights.get(cid)?.get(cat);
        if (ov !== undefined) return ov;
      }
      return defaultWeights.get(cat) ?? 0;
    };

    // เรียง batches ตาม imported_at (DESC → เอา 3 อันล่าสุด → ASC สำหรับ chart)
    // same-day → ใช้ batch_id เป็น tiebreak เพื่อให้ order deterministic
    const cmpDesc = (
      [bidA, a]: [string, { imported_at: string }],
      [bidB, b]: [string, { imported_at: string }]
    ) => {
      const ta = Date.parse(a.imported_at) || 0;
      const tb = Date.parse(b.imported_at) || 0;
      if (ta !== tb) return tb - ta;
      return bidB.localeCompare(bidA, undefined, { numeric: true });
    };
    const cmpAsc = (
      a: Parameters<typeof cmpDesc>[0],
      b: Parameters<typeof cmpDesc>[1]
    ) => -cmpDesc(a, b);

    const batches = Array.from(batchMap.entries())
      .sort(cmpDesc)    // เอา 6 อันล่าสุดตามวันที่
      .slice(0, 6)
      .sort(cmpAsc)     // แสดงผล ASC (เก่า → ใหม่)
      .map(([, entry]) => {
        const avgs = Object.fromEntries(
          CATEGORIES.map((c) => [c, entry.stats[c].count > 0 ? entry.stats[c].sum / entry.stats[c].count : 0])
        ) as Record<Category, number>;

        const calc = (cid: number | null) =>
          Math.round(CATEGORIES.reduce((acc, c) => acc + avgs[c] * getWeight(cid, c), 0) * 10) / 10;

        return {
          label: entry.label,
          imported_at: entry.imported_at,
          opponent_guild: entry.opponent_guild,
          avgs,
          rawScore: calc(classId),      // คะแนนตาม class จริง
          scoreDps:    calc(null),       // DPS = default weights
          scoreTank:   calc(1),          // Tank = id 1
          scoreHealer: calc(5),          // พระ = id 5
        };
      });

    return NextResponse.json({ ok: true, class_id: classId, batches });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
