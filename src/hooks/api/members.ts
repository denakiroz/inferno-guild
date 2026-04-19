"use client";

// React Query hooks สำหรับ Members domain
// - Query: useMembers (with optional guild filter)
// - Mutations: setColor, setRemark, setClub2, assignParty (with optimistic update where sensible)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryClient";
import { jsonFetch } from "./fetcher";

export type MemberRow = {
  id: number;
  name: string;
  class_id: number | null;
  power: number | null;
  party: number | null;
  party_2: number | null;
  pos_party: number | null;
  pos_party_2: number | null;
  color: string | null;
  is_special: boolean | null;
  guild: number | null;
  discord_user_id: string | null;
  status: string | null;
  special_text: string | null;
  remark: string | null;
  update_date: string | null;
  class?: { id: number; name: string; icon_url: string | null } | null;
  ultimate_skill_ids: number[];
  special_skill_ids: number[];
  equipment_create_ids: number[];
  weapon_gold_ids: number[];
  weapon_stones: Array<{ id: number; color: string }>;
};

export type LeaveRow = {
  id: number;
  date_time: string;
  member_id: number;
  reason: string | null;
  status: string | null;
  update_date: string | null;
};

type MembersResponse = {
  members: MemberRow[];
  leaves: LeaveRow[];
};

export function useMembers(guild?: number | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.members(guild),
    queryFn: () =>
      jsonFetch<MembersResponse>(
        guild != null ? `/api/admin/members?guild=${guild}` : "/api/admin/members"
      ),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/** Club members (ชมรม) */
export function useClubMembers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.clubMembers(),
    queryFn: () => jsonFetch<MembersResponse>("/api/admin/club-members"),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/** Club 2 members (ชมรม 2) */
export function useClub2Members(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.club2Members(),
    queryFn: () => jsonFetch<MembersResponse>("/api/admin/club-members-2"),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/** Current user session info */
export type MeUser = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
  guild: number;
  isAdmin: boolean;
};
export type MeResponse = { ok: true; user: MeUser } | { ok: false };

export function useMe() {
  return useQuery({
    queryKey: qk.me(),
    queryFn: () => jsonFetch<MeResponse>("/api/me"),
    staleTime: 5 * 60 * 1000, // session info เปลี่ยนนาน ๆ ที
    retry: 0, // อย่าลองซ้ำสำหรับ auth
  });
}

// ---------- Mutations ----------

/** set-color: bulk v2 {guild, colors:[{memberId,color}]} */
export function useSetMemberColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { guild: number; colors: Array<{ memberId: number; color: string | null }> }) =>
      jsonFetch<{ ok?: boolean; error?: string }>("/api/admin/members/set-color", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

/** set-remark: bulk v2 {guild, remarks:[{memberId,remark}]} */
export function useSetMemberRemark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { guild: number; remarks: Array<{ memberId: number; remark: string | null }> }) =>
      jsonFetch<{ ok?: boolean; error?: string }>("/api/admin/members/set-remark", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

/** set-club2: {memberId, club_2} or {memberIds[], club_2} */
export function useSetMemberClub2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { memberId?: number; memberIds?: number[]; club_2: boolean }) =>
      jsonFetch<{ ok?: boolean; error?: string }>("/api/admin/members/set-club2", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

/** assign-party: bulk */
export function useAssignParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      guild: number;
      warTime?: string;
      rows?: Array<{ id?: number; memberId?: number; party?: number | null; pos?: number | null }>;
      assignments?: Array<{ id?: number; memberId?: number; party?: number | null; pos?: number | null }>;
    }) =>
      jsonFetch<{ ok?: boolean; error?: string }>("/api/admin/members/assign-party", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
