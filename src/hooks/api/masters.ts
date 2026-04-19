"use client";

// React Query hooks สำหรับ master tables ที่เปลี่ยนไม่บ่อย
// (classes, ultimate-skills, special-skills, skill-stones) — staleTime นาน

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryClient";
import { jsonFetch } from "./fetcher";

export type ClassRow = {
  id: number;
  name: string;
  icon_url: string | null;
};

export function useClasses() {
  return useQuery({
    queryKey: qk.classes(),
    queryFn: () =>
      jsonFetch<{ ok: boolean; classes?: ClassRow[]; error?: string }>(
        "/api/admin/classes"
      ).then((j) => (j.ok ? j.classes ?? [] : Promise.reject(new Error(j.error ?? "failed")))),
    staleTime: 30 * 60 * 1000, // 30 นาที
  });
}

export function useUltimateSkills() {
  return useQuery({
    queryKey: qk.ultimateSkills(),
    queryFn: () => jsonFetch<any>("/api/admin/ultimate-skills"),
    staleTime: 30 * 60 * 1000,
  });
}

export function useSpecialSkills() {
  return useQuery({
    queryKey: qk.specialSkills(),
    queryFn: () => jsonFetch<any>("/api/admin/special-skills"),
    staleTime: 30 * 60 * 1000,
  });
}

export function useSkillStones() {
  return useQuery({
    queryKey: qk.skillStones(),
    queryFn: () => jsonFetch<any>("/api/admin/skill-stones"),
    staleTime: 30 * 60 * 1000,
  });
}
