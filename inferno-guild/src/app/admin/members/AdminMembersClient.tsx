// src/app/admin/members/AdminMembersClient.tsx
"use client";

import React, { useCallback, useState } from "react";
import Members from "./Members";
import type { DbLeave, DbMember } from "@/type/db";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
};

export default function AdminMembersClient(initial: Props) {
  const [members, setMembers] = useState<DbMember[]>(initial.members);
  const [leaves, setLeaves] = useState<DbLeave[]>(initial.leaves);
  const [isLoading, setIsLoading] = useState(false);

  const onReload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/members", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        // กันหน้าแตกเวลา token/session มีปัญหา
        console.error("Reload members failed:", json);
        return;
      }

      setMembers((json.members ?? []) as DbMember[]);
      setLeaves((json.leaves ?? []) as DbLeave[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
  <Members
    members={members}
    leaves={leaves}
    isLoading={isLoading}
    onReload={onReload}
    lockedGuild={null}
    canViewAllGuilds={true}
  />
);
}
