"use client";

// React Query hooks สำหรับ Member Potential domain
// - Queries: leaderboard, batches, batchDetail, weights, player history
// - Mutations: importBatch, updateBatch, deleteBatch, updateRecords, upsertWeight

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryClient";
import { jsonFetch } from "./fetcher";

// ---------- Types (loose — match server shape) ----------
export type LeaderboardItem = {
  userdiscordid: string;
  discordname: string;
  class_id: number | null;
  class_name: string;
  class_icon: string;
  guild: number | null;
  batch_count: number;
  avgs: Record<string, number>;
  rawScore: number;
  score: number;
  role: "dps" | "tank" | "healer";
};

export type BatchRow = {
  id: string;
  label: string;
  imported_at: string;
  opponent_guild: string | null;
  guild: number | null;
  record_count: number;
};

export type BatchRecord = {
  userdiscordid: string;
  discordname: string;
  class_id: number | null;
  class_name: string;
  class_icon: string;
  score: number;
  kill: number; assist: number; supply: number;
  damage_player: number; damage_fort: number;
  heal: number; damage_taken: number; death: number; revive: number;
};

export type WeightRow = {
  id: number;
  class_id: number | null;
  category: string;
  label: string;
  weight: number;
  enabled: boolean;
  sort_order: number;
};

// ---------- Queries ----------

export function useLeaderboard() {
  return useQuery({
    queryKey: qk.leaderboard(),
    queryFn: () =>
      jsonFetch<{ ok: boolean; items?: LeaderboardItem[]; error?: string }>(
        "/api/admin/member-potential"
      ).then((j) => (j.ok ? j.items ?? [] : Promise.reject(new Error(j.error ?? "failed")))),
    // leaderboard cache 5 min ที่ server แล้ว → ที่ client 60s (stale) ก็พอ
    staleTime: 60 * 1000,
  });
}

export function useBatches(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.batches(),
    queryFn: () =>
      jsonFetch<{ ok: boolean; items?: BatchRow[]; error?: string }>(
        "/api/admin/member-potential/batches"
      ).then((j) => (j.ok ? j.items ?? [] : Promise.reject(new Error(j.error ?? "failed")))),
    staleTime: 30 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useBatchDetail(id: string | null) {
  return useQuery({
    queryKey: qk.batchDetail(id ?? ""),
    queryFn: () =>
      jsonFetch<{ ok: boolean; batch?: BatchRow; items?: BatchRecord[]; error?: string }>(
        `/api/admin/member-potential/batches/${id}`
      ),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useWeights(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.weights(),
    queryFn: () =>
      jsonFetch<{ ok: boolean; items?: WeightRow[]; error?: string }>(
        "/api/admin/member-potential/weights"
      ).then((j) => (j.ok ? j.items ?? [] : Promise.reject(new Error(j.error ?? "failed")))),
    staleTime: 5 * 60 * 1000, // weights เปลี่ยนนาน ๆ ที
    enabled: options?.enabled ?? true,
  });
}

export function usePlayerHistory(uid: string | null) {
  return useQuery({
    queryKey: qk.player(uid ?? ""),
    queryFn: () =>
      jsonFetch<{ ok: boolean; batches?: any[]; error?: string }>(
        `/api/admin/member-potential/player?uid=${encodeURIComponent(uid!)}`
      ),
    enabled: !!uid,
    staleTime: 60 * 1000,
  });
}

// ---------- Mutations ----------

export function useImportBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      label?: string;
      opponent_guild?: string;
      guild?: number | null;
      rows: any[];
    }) =>
      jsonFetch<{ ok: boolean; batch_id?: string; count?: number; error?: string }>(
        "/api/admin/member-potential",
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leaderboard() });
      qc.invalidateQueries({ queryKey: qk.batches() });
    },
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; label?: string; opponent_guild?: string; guild?: number | null }) =>
      jsonFetch<{ ok: boolean; error?: string }>(`/api/admin/member-potential/batches/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.leaderboard() });
      qc.invalidateQueries({ queryKey: qk.batches() });
      qc.invalidateQueries({ queryKey: qk.batchDetail(vars.id) });
    },
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean; error?: string }>(`/api/admin/member-potential/batches/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leaderboard() });
      qc.invalidateQueries({ queryKey: qk.batches() });
    },
  });
}

export function useUpdateBatchRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any[] }) =>
      jsonFetch<{ ok: boolean; updated?: number; errors?: any[]; error?: string }>(
        `/api/admin/member-potential/batches/${id}/records`,
        { method: "PATCH", body: JSON.stringify({ updates }) }
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.leaderboard() });
      qc.invalidateQueries({ queryKey: qk.batchDetail(vars.id) });
    },
  });
}

export function useUpsertWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      class_id: number | null;
      category: string;
      label?: string;
      weight: number;
      enabled: boolean;
      sort_order?: number;
    }) =>
      jsonFetch<{ ok: boolean; error?: string }>(
        "/api/admin/member-potential/weights",
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.weights() });
      qc.invalidateQueries({ queryKey: qk.leaderboard() });
    },
  });
}
