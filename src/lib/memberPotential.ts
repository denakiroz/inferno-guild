// Shared leaderboard calculation logic used by both admin and public routes
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const CATEGORIES = [
  "kill", "assist", "supply", "damage_player",
  "damage_fort", "heal", "damage_taken", "death", "revive",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type LeaderboardItem = {
  userdiscordid: string;
  discordname: string;
  class_id: number | null;
  class_name: string;
  class_icon: string;
  guild: number | null;
  batch_count: number;
  avgs: Record<Category, number>;
  score: number;
};

type BuildResult =
  | { ok: true; items: LeaderboardItem[] }
  | { ok: false; error: string };

export async function buildLeaderboard(): Promise<BuildResult> {
  // 1. Records — include batch_id for per-batch averaging
  const { data: records, error: recErr } = await supabaseAdmin
    .from("member_potential_records")
    .select("batch_id,userdiscordid,kill,assist,supply,damage_player,damage_fort,heal,damage_taken,death,revive");
  if (recErr) return { ok: false, error: recErr.message };

  // 2. Active members
  const { data: members, error: memErr } = await supabaseAdmin
    .from("member")
    .select("discord_user_id,name,class_id,guild,class:class!member_class_id_fkey(id,name,icon_url)")
    .not("discord_user_id", "is", null)
    .eq("status", "active");
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

  // 3. Weights
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

  const getWeight = (classId: number | null, cat: Category): number => {
    if (classId != null) {
      const override = classWeights.get(classId)?.get(cat);
      if (override !== undefined) return override;
    }
    return defaultWeights.get(cat) ?? 0;
  };

  // 4. Step 1: Average per (userdiscordid, batch_id)
  //    key = `${uid}::${batchId}` → sum + count per category
  type CatAgg = Record<Category, { sum: number; count: number }>;
  const batchAggMap = new Map<string, CatAgg>();

  for (const r of records ?? []) {
    const uid = String(r.userdiscordid ?? "").trim();
    const bid = String(r.batch_id ?? "");
    if (!uid || !bid) continue;

    const key = `${uid}::${bid}`;
    if (!batchAggMap.has(key)) {
      batchAggMap.set(key, Object.fromEntries(CATEGORIES.map((c) => [c, { sum: 0, count: 0 }])) as CatAgg);
    }
    const agg = batchAggMap.get(key)!;
    for (const c of CATEGORIES) {
      agg[c].sum += Number((r as any)[c] ?? 0);
      agg[c].count += 1;
    }
  }

  // 4. Step 2: For each user, average the per-batch averages
  //    user → batch count + sum of batch-avgs per category
  type UserAgg = { batchSums: Record<Category, number>; batchCount: number };
  const userAggMap = new Map<string, UserAgg>();

  for (const [key, catAgg] of batchAggMap.entries()) {
    const uid = key.split("::")[0];
    if (!userAggMap.has(uid)) {
      userAggMap.set(uid, {
        batchSums: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>,
        batchCount: 0,
      });
    }
    const ua = userAggMap.get(uid)!;
    ua.batchCount += 1;
    for (const c of CATEGORIES) {
      const batchAvg = catAgg[c].count > 0 ? catAgg[c].sum / catAgg[c].count : 0;
      ua.batchSums[c] += batchAvg;
    }
  }

  // 5. Build leaderboard — all active members (default 0 if no data)
  const zeroAvgs = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;

  const leaderboard: LeaderboardItem[] = Array.from(memberMap.entries()).map(([uid, mem]) => {
    const ua = userAggMap.get(uid);
    const classId = mem.class_id;

    const avgs: Record<Category, number> = ua
      ? Object.fromEntries(
          CATEGORIES.map((c) => [c, ua.batchCount > 0 ? ua.batchSums[c] / ua.batchCount : 0])
        ) as Record<Category, number>
      : { ...zeroAvgs };

    const rawScore = CATEGORIES.reduce(
      (acc, c) => acc + avgs[c] * getWeight(classId, c),
      0
    );

    return {
      userdiscordid: uid,
      discordname: mem.name,
      class_id: classId,
      class_name: mem.class_name,
      class_icon: mem.class_icon,
      guild: mem.guild,
      batch_count: ua?.batchCount ?? 0,
      avgs,
      score: Math.round(rawScore * 10) / 10,
    };
  });

  // 6. Min-max normalize to 0–100
  const rawScores = leaderboard.map((r) => r.score);
  const minScore = Math.min(...rawScores);
  const maxScore = Math.max(...rawScores);
  const range = maxScore - minScore;

  for (const r of leaderboard) {
    r.score = range > 0
      ? Math.round(((r.score - minScore) / range) * 1000) / 10
      : 0;
  }

  leaderboard.sort((a, b) => b.score - a.score);

  return { ok: true, items: leaderboard };
}
