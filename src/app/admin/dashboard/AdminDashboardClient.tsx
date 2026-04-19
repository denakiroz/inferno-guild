"use client";

// src/app/dashboard/AdminDashboardClient.tsx
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import Dashboard from "./Dashboard";
import { qk } from "@/lib/queryClient";
import { useMembers } from "@/hooks/api/members";
import type { DbLeave, DbMember } from "@/type/db";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
};

export default function AdminDashboardClient(initial: Props) {
  const qc = useQueryClient();
  const membersQuery = useMembers(null);

  // ใช้ SSR initial ก่อน หาก React Query ยังไม่กลับ (avoid flash)
  const members: DbMember[] =
    (membersQuery.data?.members as DbMember[] | undefined) ?? initial.members;
  const leaves: DbLeave[] =
    (membersQuery.data?.leaves as DbLeave[] | undefined) ?? initial.leaves;
  const isLoading = membersQuery.isFetching;

  const onReload = async () => {
    await qc.invalidateQueries({ queryKey: qk.members(null) });
  };

  return (
    <Dashboard
      members={members}
      leaves={leaves}
      isLoading={isLoading}
      onReload={onReload}
      lockedGuild={null}
      canViewAllGuilds={true}
    />
  );
}
