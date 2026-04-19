// React Query client factory + sensible defaults for inferno-guild.
//
// staleTime 60s = ภายใน 1 นาที จะใช้ cached data โดยไม่ต้อง refetch
// gcTime 5 นาที  = หลัง unmount เก็บไว้ใน memory ไว้ก่อน เผื่อ user กลับมา
// refetchOnWindowFocus: false — admin tool, ไม่ต้องรีเฟรชทุกครั้งที่สลับ tab
// retry 1 — ลองซ้ำ 1 ครั้ง พอ (เน็ตเสีย/server หลุด)

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// --- Query key registry ---
// รวมศูนย์ key ป้องกัน typo + ใช้ invalidateQueries({ queryKey: qk.xxx() }) ได้สะดวก
export const qk = {
  /** Member potential */
  leaderboard: () => ["leaderboard"] as const,
  batches: () => ["mp", "batches"] as const,
  batchDetail: (id: string) => ["mp", "batch", id] as const,
  weights: () => ["mp", "weights"] as const,
  player: (uid: string) => ["mp", "player", uid] as const,

  /** Members */
  members: (guild?: number | null) =>
    guild == null ? (["members", "all"] as const) : (["members", "guild", guild] as const),
  memberDetail: (id: number) => ["members", "detail", id] as const,
  clubMembers: () => ["members", "club"] as const,
  club2Members: () => ["members", "club2"] as const,
  me: () => ["me"] as const,

  /** Master tables */
  classes: () => ["classes"] as const,
  ultimateSkills: () => ["ultimate-skills"] as const,
  specialSkills: () => ["special-skills"] as const,
  skillStones: () => ["skill-stones"] as const,
} as const;
