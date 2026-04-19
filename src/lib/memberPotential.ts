// Shared leaderboard calculation logic used by both admin and public routes
// ⚡ Phase 1 (2026-04-19): aggregation ย้ายไปทำใน Postgres RPC แทน JS
//    → network payload ลด ~500× เมื่อ data โต
//    → ดู supabase/migrations/20260419_leaderboard_aggregates_rpc.sql
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const CATEGORIES = [
  "kill", "assist", "supply", "damage_player",
  "damage_fort", "heal", "damage_taken", "death", "revive",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Role = "dps" | "tank" | "healer";

export function classToRole(class_id: number | null): Role {
  if (class_id === 1) return "tank";
  if (class_id === 5) return "healer";
  return "dps";
}

export type LeaderboardItem = {
  userdiscordid: string;
  discordname: string;
  class_id: number | null;
  class_name: string;
  class_icon: string;
  guild: number | null;
  batch_count: number;
  avgs: Record<Category, number>;
  rawScore: number;   // before normalization
  score: number;      // normalized 0–100 within role group
  role: Role;
};

type BuildResult =
  | { ok: true; items: LeaderboardItem[] }
  | { ok: false; error: string };

// Shape ที่ RPC get_leaderboard_aggregates() คืนกลับ (ตรงกับ migration)
type AggregateRow = {
  userdiscordid: string;
  class_id: number | null;
  batch_count: number;
  avg_kill: number;
  avg_assist: number;
  avg_supply: number;
  avg_damage_player: number;
  avg_damage_fort: number;
  avg_heal: number;
  avg_damage_taken: number;
  avg_death: number;
  avg_revive: number;
};

export async function buildLeaderboard(): Promise<BuildResult> {
  // ⚡ 3 query อิสระ — ยิงพร้อมกันด้วย Promise.all
  //    (aggregates via RPC + members + weights)
  //
  //    RPC ทำ avg-of-batch-avgs + mode(class_id) ให้หมด → ส่งกลับมาแค่
  //    1 row ต่อ user (~200 rows) แทน raw records ทั้งก้อน (~100k rows)
  const [aggRes, memRes, wRes] = await Promise.all([
    supabaseAdmin.rpc("get_leaderboard_aggregates"),
    supabaseAdmin
      .from("member")
      .select("discord_user_id,name,class_id,guild,class:class!member_class_id_fkey(id,name,icon_url)")
      .not("discord_user_id", "is", null)
      .eq("status", "active"),
    supabaseAdmin
      .from("member_potential_weights")
      .select("class_id,category,weight,enabled"),
  ]);

  // 1. User aggregates (pre-computed ใน DB)
  const { data: aggregates, error: aggErr } = aggRes;
  if (aggErr) return { ok: false, error: aggErr.message };

  const userAggMap = new Map<string, AggregateRow>();
  for (const a of (aggregates ?? []) as AggregateRow[]) {
    if (a.userdiscordid) userAggMap.set(String(a.userdiscordid), a);
  }

  // 2. Active members
  const { data: members, error: memErr } = memRes;
  if (memErr) return { ok: false, error: memErr.message };

  const memberMap = new Map<string, {
    name: string; class_id: number | null;
    class_name: string; class_icon: string; guild: number | null;
  }>();
  for (const m of members ?? []) {
    if (!m.discord_user_id) continue;
    const cls = Array.isArray(m.class) ? m.class[0] : (m.class as any);
    memberMap.set(String(m.discord_user_id), {
      name: m.name ?? "",
      class_id: m.class_id ? Number(m.class_id) : null,
      class_name: cls?.name ?? "",
      class_icon: cls?.icon_url ?? "",
      guild: m.guild ? Number(m.guild) : null,
    });
  }

  // 3. Weights — มาจาก Promise.all ด้านบนแล้ว
  const { data: weights } = wRes;

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

  const getWeight = (classId: number | null, cat: Category): number => {
    if (classId != null) {
      const override = classWeights.get(classId)?.get(cat);
      if (override !== undefined) return override;
    }
    return defaultWeights.get(cat) ?? 0;
  };

  // 4. Build leaderboard — all active members (default 0 ถ้าไม่มี data)
  const zeroAvgs = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;

  const leaderboard: LeaderboardItem[] = Array.from(memberMap.entries()).map(([uid, mem]) => {
    const agg = userAggMap.get(uid);
    // scoreClassId = class snapshot จาก records (ใช้ weight ตาม class ตอนเล่นจริง)
    const scoreClassId = agg && agg.class_id != null ? agg.class_id : mem.class_id;
    // role ใช้ current class_id — ย้ายอาชีพแล้ว role ย้ายตาม
    const classId = mem.class_id ?? scoreClassId;
    const role = classToRole(classId);

    const avgs: Record<Category, number> = agg
      ? {
          kill:          Number(agg.avg_kill)          || 0,
          assist:        Number(agg.avg_assist)        || 0,
          supply:        Number(agg.avg_supply)        || 0,
          damage_player: Number(agg.avg_damage_player) || 0,
          damage_fort:   Number(agg.avg_damage_fort)   || 0,
          heal:          Number(agg.avg_heal)          || 0,
          damage_taken:  Number(agg.avg_damage_taken)  || 0,
          death:         Number(agg.avg_death)         || 0,
          revive:        Number(agg.avg_revive)        || 0,
        }
      : { ...zeroAvgs };

    const rawScore = CATEGORIES.reduce(
      (acc, c) => acc + avgs[c] * getWeight(scoreClassId, c),
      0
    );

    return {
      userdiscordid: uid,
      discordname: mem.name,
      class_id: classId,
      class_name: mem.class_name,
      class_icon: mem.class_icon,
      guild: mem.guild,
      batch_count: agg ? Number(agg.batch_count) || 0 : 0,
      avgs,
      rawScore,
      score: Math.round(rawScore * 10) / 10,
      role,
    };
  });

  // Sort by role group first, then by score desc within group
  leaderboard.sort((a, b) => {
    const roleOrder: Record<Role, number> = { dps: 0, tank: 1, healer: 2 };
    if (a.role !== b.role) return roleOrder[a.role] - roleOrder[b.role];
    return b.score - a.score;
  });

  return { ok: true, items: leaderboard };
}
