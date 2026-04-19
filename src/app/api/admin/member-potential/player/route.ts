// GET /api/admin/member-potential/player?uid=xxx
// ดึงสถิติย้อนหลังทุก batch ของผู้เล่นคนนั้น พร้อมคะแนนราย batch
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CATEGORIES } from "@/lib/memberPotential";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
    if (!sid) return NextResponse.json({ ok: false }, { status: 401 });
    const session = await getSession(sid);
    if (!session || !(session.isAdmin || session.isHead))
      return NextResponse.json({ ok: false }, { status: 403 });

    const uid = new URL(req.url).searchParams.get("uid");
    if (!uid) return NextResponse.json({ ok: false, error: "uid required" }, { status: 400 });

    // ⚡ records + weights อิสระต่อกัน — ยิงพร้อมกัน
    const [recordsRes, weightsRes] = await Promise.all([
      supabaseAdmin
        .from("member_potential_records")
        .select(`
          batch_id,
          class_id,
          kill, assist, supply,
          damage_player, damage_fort,
          heal, damage_taken, death, revive,
          member_potential_batches!inner(id, label, imported_at, opponent_guild)
        `)
        .eq("userdiscordid", uid)
        .order("member_potential_batches(imported_at)", { ascending: false }),
      supabaseAdmin
        .from("member_potential_weights")
        .select("class_id,category,weight,enabled"),
    ]);

    const { data: records, error } = recordsRes;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const { data: weights } = weightsRes;

    const defaultWeights = new Map<string, number>();
    const classWeightsMap = new Map<number, Map<string, number>>();
    for (const w of weights ?? []) {
      if (!w.enabled) continue;
      const val = Number(w.weight);
      if (w.class_id == null) {
        defaultWeights.set(w.category, val);
      } else {
        const cid = Number(w.class_id);
        if (!classWeightsMap.has(cid)) classWeightsMap.set(cid, new Map());
        classWeightsMap.get(cid)!.set(w.category, val);
      }
    }

    const getWeight = (classId: number | null, cat: string): number => {
      if (classId != null) {
        const override = classWeightsMap.get(classId)?.get(cat);
        if (override !== undefined) return override;
      }
      return defaultWeights.get(cat) ?? 0;
    };

    // Group by batch_id → avg per batch
    type BatchAgg = {
      batch_id: string;
      label: string;
      imported_at: string;
      opponent_guild: string | null;
      class_id: number | null;
      sums: Record<string, number>;
      count: number;
    };

    const batchMap = new Map<string, BatchAgg>();

    for (const r of records ?? []) {
      const bid = String(r.batch_id);
      const batchInfo = Array.isArray(r.member_potential_batches)
        ? r.member_potential_batches[0]
        : (r.member_potential_batches as any);

      if (!batchMap.has(bid)) {
        batchMap.set(bid, {
          batch_id: bid,
          label: batchInfo?.label ?? "",
          imported_at: batchInfo?.imported_at ?? "",
          opponent_guild: batchInfo?.opponent_guild ?? null,
          class_id: r.class_id != null ? Number(r.class_id) : null,
          sums: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
          count: 0,
        });
      }
      const agg = batchMap.get(bid)!;
      agg.count += 1;
      for (const c of CATEGORIES) {
        agg.sums[c] += Number((r as any)[c] ?? 0);
      }
    }

    // Sort by imported_at desc — return all (client handles range filter)
    const sorted = Array.from(batchMap.values())
      .sort((a, b) => b.imported_at.localeCompare(a.imported_at));

    const batches = sorted.map((b) => {
      const avgs = Object.fromEntries(
        CATEGORIES.map((c) => [c, b.count > 0 ? Math.round((b.sums[c] / b.count) * 10) / 10 : 0])
      );
      // คำนวณ score ราย batch ด้วย weight ของ class นั้น
      const rawScore = CATEGORIES.reduce(
        (acc, c) => acc + (avgs[c] ?? 0) * getWeight(b.class_id, c),
        0
      );
      return {
        batch_id: b.batch_id,
        label: b.label,
        imported_at: b.imported_at,
        opponent_guild: b.opponent_guild,
        class_id: b.class_id,
        avgs,
        score: Math.round(rawScore * 10) / 10,
      };
    });

    return NextResponse.json({ ok: true, batches });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
