"use client";

// src/app/dashboard/AdminDashboardClient.tsx
import React, { useCallback, useState } from "react";
import Dashboard from "./Dashboard";
import type { DbLeave, DbMember } from "@/type/db";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
};

export default function AdminDashboardClient(initial: Props) {
  const [members, setMembers] = useState<DbMember[]>(initial.members);
  const [leaves, setLeaves] = useState<DbLeave[]>(initial.leaves);
  const [isLoading, setIsLoading] = useState(false);

  const onReload = useCallback(async () => {
    setIsLoading(true);
    try {
      // reuse endpoint เดียวกับหน้า /admin/members (คืน member+leave)
      const res = await fetch("/api/admin/members", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        console.error("Reload dashboard failed:", json);
        return;
      }

      setMembers((json.members ?? []) as DbMember[]);
      setLeaves((json.leaves ?? []) as DbLeave[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
