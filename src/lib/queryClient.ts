// React Query client factory + sensible defaults for inferno-guild.

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

// Query key registry
export const qk = {
  // Member potential
  leaderboard: (seasonId?: number | null) =>
    seasonId != null ? (["leaderboard", seasonId] as const) : (["leaderboard"] as const),
  batches: () => ["mp", "batches"] as const,
  batchDetail: (id: string) => ["mp", "batch", id] as const,
  weights: () => ["mp", "weights"] as const,
  player: (uid: string) => ["mp", "player", uid] as const,
  seasons: () => ["mp", "seasons"] as const,

  // Members
  members: (guild?: number | null) =>
    guild == null ? (["members", "all"] as const) : (["members", "guild", guild] as const),
  memberDetail: (id: number) => ["members", "detail", id] as const,
  clubMembers: () => ["members", "club"] as const,
  club2Members: () => ["members", "club2"] as const,
  me: () => ["me"] as const,

  // Master tables
  classes: () => ["classes"] as const,
  ultimateSkills: () => ["ultimate-skills"] as const,
  specialSkills: () => ["special-skills"] as const,
  skillStones: () => ["skill-stones"] as const,
} as const;
